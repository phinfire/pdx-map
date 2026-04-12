import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-string-input',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatInputModule, MatFormFieldModule, FormsModule],
  templateUrl: './string-input.component.html',
  styleUrl: './string-input.component.scss',
})
export class StringInputComponent {
  inputValue: string = '';

  constructor(
    public dialogRef: MatDialogRef<StringInputComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { currentName: string }
  ) {
    if (data && data.currentName) {
      this.inputValue = data.currentName;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onOk(): void {
    this.dialogRef.close(this.inputValue);
  }
}
