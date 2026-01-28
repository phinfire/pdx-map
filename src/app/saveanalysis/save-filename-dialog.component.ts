import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-save-filename-dialog',
    standalone: true,
    imports: [MatDialogModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
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
export class SaveFileNameDialogComponent {
    fileName: string = '';
    private dialogRef = inject(MatDialogRef<SaveFileNameDialogComponent>);
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
