import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';

@Component({
    selector: 'app-date-time-picker',
    imports: [FormsModule, MatFormFieldModule, MatDatepickerModule, MatTimepickerModule, MatInputModule, MatNativeDateModule],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => DateTimePickerComponent),
            multi: true
        }
    ],
    templateUrl: './date-time-picker.component.html',
    styleUrl: './date-time-picker.component.scss',
})
export class DateTimePickerComponent implements ControlValueAccessor {

    @Input() title = '';

    value: Date | null = null;

    private onChange = (value: Date | null) => { };
    private onTouched = () => { };

    writeValue(value: Date | null): void {
        this.value = value ? new Date(value) : null;
    }

    registerOnChange(fn: (value: Date | null) => void): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: () => void): void {
        this.onTouched = fn;
    }

    setDisabledState(): void { }

    onValueChange(value: Date | null) {
        this.value = value ? new Date(value) : null;
        this.onChange(this.value);
        this.onTouched();
    }
}