// Suppress expected stderr warnings during testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const suppressedMessages = [
    'AssignmentService: Error fetching assignments',
    'Failed to load EU4 save',
    'Failed to import CK3 save',
    'Failed to fetch',
    'MegaService: Failed to fetch',
    'The operation was aborted',
    'socket hang up',
    'DOMException [AbortError]',
    'DOMException [NetworkError]',
    'reader.readAsArrayBuffer is not a function'
];

console.error = (...args: any[]) => {
    const message = args.join(' ');
    if (!suppressedMessages.some(msg => message.includes(msg))) {
        originalConsoleError(...args);
    }
};

console.warn = (...args: any[]) => {
    const message = args.join(' ');
    if (!suppressedMessages.some(msg => message.includes(msg))) {
        originalConsoleWarn(...args);
    }
};

// Initialize TestBed for Angular testing
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Mock Image API for test environment (happy-dom doesn't implement it fully)
if (typeof global !== 'undefined') {
    const OriginalImage = Image;
    global.Image = class MockImage extends OriginalImage {
        set src(value: string) {
            // Simulate successful image load in tests
            setTimeout(() => {
                if (this.onload) {
                    this.onload({ target: this } as any);
                }
            }, 0);
        }
    } as any;
}

// Suppress unhandled rejection errors from happy-dom teardown
if (typeof process !== 'undefined' && process.env) {
    process.on('unhandledRejection', (reason: any) => {
        const message = String(reason);
        if (!suppressedMessages.some(msg => message.includes(msg))) {
            // Re-throw unexpected rejections
            throw reason;
        }
        // Silently ignore expected rejections
    });
}
