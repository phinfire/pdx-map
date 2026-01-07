import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { DiscordAuthenticationService } from '../services/discord-auth.service';
import * as pako from 'pako';

export interface SaveFileListResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    size: number;
}

export interface SaveFileDownloadResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    compressed_data: string;
    size: number;
}

export interface SaveFileUploadResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    size: number;
}

export interface SaveFileUpdateResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    updated_at: string;
    size: number;
}

export interface SaveFileDeleteResponse {
    success: boolean;
    id: string;
}

@Injectable({
    providedIn: 'root',
})
export class SaveDatabaseService {
    private readonly API_URL = 'https://codingafterdark.de/skanderbeg/savefiles';

    private readonly _saveFiles$ = new BehaviorSubject<SaveFileListResponse[]>([]);
    public readonly saveFiles$ = this._saveFiles$.asObservable();

    private http = inject(HttpClient);
    private authService = inject(DiscordAuthenticationService);

    private compressData(data: Uint8Array): Uint8Array {
        return pako.gzip(data);
    }

    private hexToUint8Array(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    private decompressData(compressedHex: string): Uint8Array {
        const compressedData = this.hexToUint8Array(compressedHex);
        return pako.ungzip(compressedData);
    }

    listSaveFiles(): Observable<SaveFileListResponse[]> {
        return this.http.get<SaveFileListResponse[]>(this.API_URL).pipe(
            tap(saveFiles => this._saveFiles$.next(saveFiles)),
            catchError(error => {
                console.error('Failed to list save files:', error);
                return of([]);
            })
        );
    }

    downloadSaveFile(savefileId: string): Observable<Uint8Array> {
        return this.http.get<SaveFileDownloadResponse>(
            `${this.API_URL}/${savefileId}`
        ).pipe(
            map(response => this.decompressData(response.compressed_data)),
            catchError(error => {
                console.error(`Failed to download save file ${savefileId}:`, error);
                throw error;
            })
        );
    }

    uploadSaveFile(
        file: File,
        metadata: Record<string, any>,
        customId?: string
    ): Observable<SaveFileUploadResponse> {
        return from(this.readFileAsArrayBuffer(file)).pipe(
            map(buffer => this.compressData(new Uint8Array(buffer))),
            switchMap(compressedData => {
                const formData = new FormData();
                formData.append('file', new File([compressedData as any], file.name, { type: 'application/octet-stream' }));
                formData.append('metadata', JSON.stringify(metadata));
                console.log('Uploading file with metadata:', metadata);
                if (customId) {
                    formData.append('id', customId);
                }

                const headers = new HttpHeaders({
                    ...this.authService.getAuthenticationHeader()
                });

                return this.http.post<SaveFileUploadResponse>(this.API_URL, formData, {
                    headers
                }).pipe(
                    tap(() => {
                        this.listSaveFiles().subscribe();
                    })
                );
            }),
            catchError(error => {
                console.error('Failed to upload save file:', error);
                throw error;
            })
        );
    }

    private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    updateSaveFile(
        savefileId: string,
        file: File,
        metadata?: Record<string, any>
    ): Observable<SaveFileUpdateResponse> {
        return from(this.readFileAsArrayBuffer(file)).pipe(
            map(buffer => this.compressData(new Uint8Array(buffer))),
            switchMap(compressedData => {
                const formData = new FormData();
                formData.append('file', new File([compressedData as any], file.name, { type: 'application/octet-stream' }));
                if (metadata) {
                    formData.append('metadata', JSON.stringify(metadata));
                }

                const headers = new HttpHeaders({
                    ...this.authService.getAuthenticationHeader()
                });

                console.log('Update headers:', headers.keys());
                console.log('Auth header:', headers.get('Authorization'));

                return this.http.put<SaveFileUpdateResponse>(
                    `${this.API_URL}/${savefileId}`,
                    formData,
                    { headers }
                ).pipe(
                    tap(() => {
                        this.listSaveFiles().subscribe();
                    })
                );
            }),
            catchError(error => {
                console.error(`Failed to update save file ${savefileId}:`, error);
                throw error;
            })
        );
    }

    deleteSaveFile(savefileId: string): Observable<SaveFileDeleteResponse> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.authService.getAuthenticationHeader()
        });

        return this.http.delete<SaveFileDeleteResponse>(
            `${this.API_URL}/${savefileId}`,
            { headers }
        ).pipe(
            tap(() => {
                // Refresh the list after successful delete
                this.listSaveFiles().subscribe();
            }),
            catchError(error => {
                console.error(`Failed to delete save file ${savefileId}:`, error);
                throw error;
            })
        );
    }
}
