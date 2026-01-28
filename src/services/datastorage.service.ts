import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from, throwError } from 'rxjs';
import { catchError, tap, map, switchMap } from 'rxjs/operators';
import { DiscordAuthenticationService } from '../services/discord-auth.service';
import * as pako from 'pako';

export interface FileListResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    size: number;
}

export interface FileDownloadResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    compressed_data: string;
    size: number;
}

export interface FileUploadResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    created_at: string;
    size: number;
}

export interface FileUpdateResponse {
    id: string;
    user_id: string;
    metadata: Record<string, any>;
    updated_at: string;
    size: number;
}

export interface FileDeleteResponse {
    success: boolean;
    id: string;
}

@Injectable({
    providedIn: 'root',
})
export class DataStorageService {
    private readonly API_URL = 'https://codingafterdark.de/skanderbeg/savefiles';

    private readonly _files$ = new BehaviorSubject<FileListResponse[]>([]);
    public readonly files$ = this._files$.asObservable();

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

    listFiles(): Observable<FileListResponse[]> {
        return this.http.get<FileListResponse[]>(this.API_URL).pipe(
            tap(files => this._files$.next(files)),
            catchError(error => {
                console.error('Failed to list files:', error);
                return of([]);
            })
        );
    }

    downloadFile(fileId: string): Observable<Uint8Array> {
        return this.http.get<FileDownloadResponse>(
            `${this.API_URL}/${fileId}`
        ).pipe(
            map(response => this.decompressData(response.compressed_data)),
            catchError(error => {
                console.error(`Failed to download file ${fileId}:`, error);
                throw error;
            })
        );
    }

    uploadFile(
        file: File,
        metadata: Record<string, any>,
        customId?: string
    ): Observable<FileUploadResponse> {
        return from(this.readFileAsArrayBuffer(file)).pipe(
            map(buffer => this.compressData(new Uint8Array(buffer))),
            switchMap(compressedData =>
                this.performUpload(compressedData, file.name, metadata, this.API_URL, 'post', customId)
            ),
            catchError(error => {
                console.error('Failed to upload file:', error);
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

    uploadString(
        data: string,
        metadata: Record<string, any>,
        fileName: string = 'data.txt',
        customId?: string
    ): Observable<FileUploadResponse> {
        const buffer = new TextEncoder().encode(data);
        const compressedData = this.compressData(buffer);
        return this.performUpload(compressedData, fileName, metadata, this.API_URL, 'post', customId);
    }

    updateFile(
        fileId: string,
        file: File,
        metadata?: Record<string, any>
    ): Observable<FileUpdateResponse> {
        return from(this.readFileAsArrayBuffer(file)).pipe(
            map(buffer => this.compressData(new Uint8Array(buffer))),
            switchMap(compressedData =>
                this.performUpload(compressedData, file.name, metadata || {}, `${this.API_URL}/${fileId}`, 'put')
            ),
            catchError(error => {
                console.error(`Failed to update file ${fileId}:`, error);
                throw error;
            })
        );
    }

    private performUpload(
        compressedData: Uint8Array,
        fileName: string,
        metadata: Record<string, any>,
        url: string,
        method: 'post' | 'put',
        customId?: string
    ): Observable<any> {
        if (this.authService.isLoggedIn() === false) {
            return throwError(() => new Error('User is not authenticated'));
        }
        const formData = new FormData();
        formData.append('file', new File([compressedData as any], fileName, { type: 'application/octet-stream' }));
        formData.append('metadata', JSON.stringify(metadata));
        if (customId) {
            formData.append('id', customId);
        }

        const headers = new HttpHeaders({
            ...this.authService.getAuthenticationHeader()
        });

        const request$ = method === 'post'
            ? this.http.post(url, formData, { headers })
            : this.http.put(url, formData, { headers });

        return request$.pipe(
            tap(() => this.listFiles().subscribe()),
            catchError(error => {
                console.error(`Failed to perform ${method}:`, error);
                throw error;
            })
        );
    }

    deleteFile(fileId: string): Observable<FileDeleteResponse> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.authService.getAuthenticationHeader()
        });

        return this.http.delete<FileDeleteResponse>(
            `${this.API_URL}/${fileId}`,
            { headers }
        ).pipe(
            tap(() => {
                this.listFiles().subscribe();
            }),
            catchError(error => {
                console.error(`Failed to delete file ${fileId}:`, error);
                throw error;
            })
        );
    }
}
