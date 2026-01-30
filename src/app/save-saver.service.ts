import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of, throwError } from 'rxjs';
import { catchError, concatMap, map, tap } from 'rxjs/operators';
import { Vic3Save } from '../model/vic/Vic3Save';
import { DataStorageService, FileUploadResponse } from '../services/datastorage.service';
import { Eu4Save } from '../model/games/eu4/Eu4Save';

export type GameType = 'ck3' | 'vic3' | 'eu4';

export interface SaveMetadata extends Record<string, any> {
    kind: 'save';
    game: GameType;
    hash: string;
    fileName?: string;
    realDate: string;
    ingameDate: string;
    subfiles?: Record<string, { id: string }>;
}

export interface SaveInfo {
    id: string;
    metadata: SaveMetadata;
}

export interface SaveUploadResponse {
    success: boolean;
    message: string;
    id?: string;
}

export interface SubfileMeta {
    kind: string;
    data: string;
    game: string;
    metadataKey: string;
    fileName: string;
}

export interface UploadFileMeta {
    kind: string;
    data: string;
    game: string;
    metadataKey: string;
    fileName?: string;
}

@Injectable({
    providedIn: 'root',
})
export class SaveSaverService {

    private saveDatabaseService = inject(DataStorageService);

    public getAvailableSavesAndMetadata(): Observable<SaveInfo[]> {
        return this.saveDatabaseService.listFiles().pipe(
            map(files => files
                .filter((file): file is { id: string; metadata: SaveMetadata } & typeof file => 
                    file.metadata?.['kind'] === 'save'
                )
                .map(file => ({ id: file.id, metadata: file.metadata }))
            )
        );
    }

    public getGameFromSaveMetadata(save: SaveInfo | { metadata: SaveMetadata }): GameType | null {
        const game = save.metadata?.game?.toLowerCase() as GameType;
        return (['ck3', 'vic3', 'eu4'] as const).includes(game) ? game : null;
    }

    public getSaveFileByIdentifier(saveId: string): Observable<any> {
        return this.saveDatabaseService.downloadFile(saveId).pipe(
            map(data => {
                const decodedString = new TextDecoder().decode(data);
                const parsed = JSON.parse(decodedString);
                return Vic3Save.fromJSON(parsed);
            })
        );
    }

    public getSaveFileIdentifierIfHasAlreadyBeenUploaded(save: Vic3Save): Observable<string | null> {
        const serialized = JSON.stringify(save.toJson());
        return this.hashData(serialized).pipe(
            concatMap(hash => this.saveDatabaseService.listFiles().pipe(
                map(files => {
                    const matching = files.find(file => file.metadata?.['hash'] === hash);
                    return matching?.id || null;
                }),
                catchError(() => of(null))
            ))
        );
    }

    storeVic3Save(save: Vic3Save, fileName: string): Observable<SaveUploadResponse> {
        const mainData = save.toJson() as any;
        const serialized = JSON.stringify(mainData);
        return this.hashData(serialized).pipe(
            concatMap(hash => {
                const subfiles: SubfileMeta[] = [
                    {
                        kind: 'demographics',
                        data: JSON.stringify(save.getDemographics(save.getCountries(true))),
                        metadataKey: 'demographics',
                        game: 'vic3',
                        fileName: `${fileName}_demographics`
                    }
                ];
                const mainFileConfig = { kind: 'save' as const, game: 'vic3' as GameType, fileName, realDate: save.getRealDate().toISOString(), ingameDate: save.getIngameDate().toISOString() };
                return this.uploadSaveWithSubfiles(mainData, mainFileConfig, subfiles, hash);
            })
        );
    }

    storeEu4Save(save: Eu4Save, fileName: string, realDate: Date): Observable<SaveUploadResponse> {
        const mainData = save.toJSON() as any;
        const serialized = JSON.stringify(mainData);
        return this.hashData(serialized).pipe(
            concatMap(hash => {
                const mainFileConfig = { kind: 'save' as const, game: 'eu4' as GameType, fileName, realDate: realDate.toISOString(), ingameDate: save.getIngameDate().toISOString() };
                return this.uploadSaveWithSubfiles(mainData, mainFileConfig, [], hash);
            })
        );
    }

    private uploadSaveWithSubfiles(
        mainObject: any,
        mainFileConfig: { kind: string; game: GameType; fileName?: string; realDate: string; ingameDate: string },
        subfiles: SubfileMeta[],
        hash: string
    ): Observable<SaveUploadResponse> {
        return this.uploadFilesSequentially(subfiles, `${mainFileConfig.game} subfiles`).pipe(
            concatMap((subfileResult) => {
                if (Object.keys(subfileResult.metadata).length > 0) {
                    if (!mainObject.metadata) {
                        mainObject.metadata = {};
                    }
                    mainObject.metadata.subfiles = subfileResult.metadata;
                }

                if (!mainObject.metadata) {
                    mainObject.metadata = {};
                }
                mainObject.metadata.hash = hash;
                mainObject.metadata.realDate = mainFileConfig.realDate;
                mainObject.metadata.ingameDate = mainFileConfig.ingameDate;

                const serializedMain = JSON.stringify(mainObject);
                const mainFileArray: UploadFileMeta[] = [{
                    kind: mainFileConfig.kind,
                    data: serializedMain,
                    game: mainFileConfig.game,
                    metadataKey: mainFileConfig.kind,
                    fileName: mainFileConfig.fileName
                }];

                return this.uploadFilesSequentially(mainFileArray, mainFileConfig.game).pipe(
                    catchError((error) => {
                        const deleteOperations = subfileResult.uploaded.map(file =>
                            this.saveDatabaseService.deleteFile(file.id).pipe(
                                tap(() => console.log(`Cleaned up ${file.kind} file (id: ${file.id})`)),
                                catchError(err => {
                                    console.error(`Failed to clean up ${file.kind} file (id: ${file.id}):`, err);
                                    return throwError(() => err);
                                })
                            )
                        );
                        if (deleteOperations.length === 0) {
                            return throwError(() => error);
                        }

                        return forkJoin(deleteOperations).pipe(
                            concatMap(() => throwError(() => error))
                        );
                    })
                );
            }),
            tap(() => {
                console.log(`All ${mainFileConfig.game} files uploaded successfully`);
            }),
            catchError((error) => {
                return throwError(() => ({
                    success: false,
                    message: error.message || 'Unknown error occurred during upload'
                }));
            }),
            map((mainFileResult) => ({ 
                success: true, 
                message: `${mainFileConfig.game} save and all subfiles uploaded successfully`,
                id: mainFileResult.uploaded[0]?.id
            }))
        );
    }

    private hashData(data: string): Observable<string> {
        return from(
            (async () => {
                const encoder = new TextEncoder();
                const dataBuffer = encoder.encode(data);
                const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            })()
        );
    }

    private uploadFilesSequentially(
        files: UploadFileMeta[],
        context: string
    ): Observable<{ uploaded: Array<{ id: string; kind: string; metadataKey: string }>; metadata: Record<string, { id: string }> }> {
        if (files.length === 0) {
            return of({ uploaded: [], metadata: {} });
        }

        const uploaded: Array<{ id: string; kind: string; metadataKey: string }> = [];
        const metadata: Record<string, { id: string }> = {};

        let chain$ = this.saveDatabaseService.uploadString(files[0].data, {
            kind: files[0].kind,
            game: files[0].game,
            ...(files[0].fileName && { fileName: files[0].fileName })
        }).pipe(
            tap((response: FileUploadResponse) => {
                const uploadedFile = { id: response?.id, kind: files[0].kind, metadataKey: files[0].metadataKey };
                uploaded.push(uploadedFile);
                metadata[files[0].metadataKey] = { id: response?.id };
                console.log(`${context}: ${files[0].game} ${files[0].kind} uploaded successfully (id: ${response?.id})`);
            }),
            catchError((error) => {
                console.error(`Error uploading ${context}: ${files[0].kind}:`, error);
                return throwError(() => new Error(`Failed to upload ${files[0].kind}: ${error?.message || 'Unknown error'}`));
            })
        );


        for (let i = 1; i < files.length; i++) {
            const file = files[i];
            chain$ = chain$.pipe(
                concatMap(() =>
                    this.saveDatabaseService.uploadString(file.data, {
                        kind: file.kind,
                        game: file.game,
                        ...(file.fileName && { fileName: file.fileName })
                    }).pipe(
                        tap((response: FileUploadResponse) => {
                            const uploadedFile = { id: response?.id, kind: file.kind, metadataKey: file.metadataKey };
                            uploaded.push(uploadedFile);
                            metadata[file.metadataKey] = { id: response?.id };
                            console.log(`${context}: ${file.game} ${file.kind} uploaded successfully (id: ${response?.id})`);
                        }),
                        catchError((error) => {
                            console.error(`Error uploading ${context}: ${file.kind}:`, error);
                            const deleteOperations = uploaded.map(u =>
                                this.saveDatabaseService.deleteFile(u.id).pipe(
                                    tap(() => console.log(`Cleaned up ${u.kind} file (id: ${u.id})`)),
                                    catchError(err => {
                                        console.error(`Failed to clean up ${u.kind} file (id: ${u.id}):`, err);
                                        return throwError(() => err);
                                    })
                                )
                            );

                            if (deleteOperations.length === 0) {
                                return throwError(() => new Error(`Failed to upload ${file.kind}: ${error?.message || 'Unknown error'}`));
                            }

                            return forkJoin(deleteOperations).pipe(
                                concatMap(() => throwError(() => new Error(`Failed to upload ${file.kind}: ${error?.message || 'Unknown error'}`)))
                            );
                        })
                    )
                )
            );
        }

        return chain$.pipe(
            map((): { uploaded: Array<{ id: string; kind: string; metadataKey: string }>; metadata: Record<string, { id: string }> } => ({ uploaded, metadata }))
        );
    }
}