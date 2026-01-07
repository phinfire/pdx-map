import { Component, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SaveDatabaseService, SaveFileListResponse } from '../savedatabase.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-savefileadmin',
    imports: [CommonModule, FormsModule, MatListModule, MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, MatDialogModule, MatFormFieldModule, MatInputModule],
    templateUrl: './savefileadmin.component.html',
    styleUrl: './savefileadmin.component.scss',
})
export class SavefileadminComponent implements OnInit, OnDestroy {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private saveService = inject(SaveDatabaseService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  saveFiles: SaveFileListResponse[] = [];
  selectedSaveId: string | null = null;
  selectedSave: SaveFileListResponse | null = null;
  isLoading = false;
  isUploading = false;
  isDeleting = false;

    ngOnInit(): void {
        this.loadSaveFiles();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadSaveFiles(): void {
        this.isLoading = true;
        this.saveService.listSaveFiles().pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: (files: SaveFileListResponse[]) => {
                this.saveFiles = files;
                this.isLoading = false;
            },
            error: (err: unknown) => {
                console.error('Failed to load save files:', err);
                this.isLoading = false;
            }
        });
    }

    selectSave(save: SaveFileListResponse): void {
        this.selectedSaveId = save.id;
        this.selectedSave = save;
    }

    formatDate(dateString: string): string {
        return new Date(dateString).toLocaleString();
    }

    formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    onUploadFile(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const dialogRef = this.dialog.open(FileNameDialogComponent, {
            width: '400px',
            data: { fileName: file.name }
        });

        dialogRef.afterClosed().pipe(
            takeUntil(this.destroy$)
        ).subscribe(result => {
            if (result) {
                this.uploadFile(file, result);
            }
            input.value = '';
        });
    }

    private uploadFile(file: File, fileName: string): void {
        const metadata = { fileName };

        this.isUploading = true;
        this.snackBar.open(`Uploading ${fileName}...`, undefined, { 
            duration: 0,
        });

        this.saveService.uploadSaveFile(file, metadata).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this.loadSaveFiles();
                this.isUploading = false;
                this.snackBar.dismiss();
                this.snackBar.open('File uploaded successfully', 'Close', { 
                    duration: 3000,
                });
            },
            error: (err: unknown) => {
                console.error('Upload failed:', err);
                this.isUploading = false;
                this.snackBar.dismiss();
                this.snackBar.open('Upload failed', 'Close', { 
                    duration: 5000,
                });
            }
        });
    }

    onDeleteSelected(): void {
        if (!this.selectedSaveId) return;

        if (!confirm(`Delete save file "${this.selectedSaveId}"?`)) return;

        this.isDeleting = true;
        this.saveService.deleteSaveFile(this.selectedSaveId).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                this.selectedSaveId = null;
                this.selectedSave = null;
                this.loadSaveFiles();
                this.isDeleting = false;
            },
            error: (err: unknown) => {
                console.error('Delete failed:', err);
                this.isDeleting = false;
            }
        });
    }

    onDelete(saveId: string, event: Event): void {
        event.stopPropagation();
        
        if (!confirm(`Delete save file "${saveId}"?`)) return;

        this.isDeleting = true;
        this.saveService.deleteSaveFile(saveId).pipe(
            takeUntil(this.destroy$)
        ).subscribe({
            next: () => {
                if (this.selectedSaveId === saveId) {
                    this.selectedSaveId = null;
                    this.selectedSave = null;
                }
                this.loadSaveFiles();
                this.isDeleting = false;
            },
            error: (err: unknown) => {
                console.error('Delete failed:', err);
                this.isDeleting = false;
            }
        });
    }

    onAddNew(): void {
        this.fileInput.nativeElement.click();
    }

    copyIdToClipboard(id: string): void {
        navigator.clipboard.writeText(id).then(() => {
            this.snackBar.open('ID copied to clipboard', 'Close', { 
                duration: 2000,
                verticalPosition: 'top'
            });
        }).catch(() => {
            this.snackBar.open('Failed to copy ID', 'Close', { 
                duration: 3000,
                verticalPosition: 'top'
            });
        });
    }
}

@Component({
    selector: 'app-filename-dialog',
    standalone: true,
    imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
    template: `
        <div mat-dialog-title>Enter file name</div>
        <mat-dialog-content>
            <mat-form-field appearance="outline" class="full-width">
                <mat-label>File name</mat-label>
                <input matInput [(ngModel)]="fileName" (keyup.enter)="onConfirm()">
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button (click)="onCancel()">Cancel</button>
            <button mat-raised-button color="primary" (click)="onConfirm()">Upload</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .full-width {
            width: 100%;
        }
    `]
})
export class FileNameDialogComponent {
    fileName: string = '';
    private dialogRef = inject(MatDialogRef<FileNameDialogComponent>);
    private data = inject(MAT_DIALOG_DATA);

    constructor() {
        this.fileName = this.data.fileName || '';
    }

    onConfirm(): void {
        if (this.fileName.trim()) {
            this.dialogRef.close(this.fileName);
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}