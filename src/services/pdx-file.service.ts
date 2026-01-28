import { Injectable } from '@angular/core';
import { Jomini } from 'jomini';
import JSZip from 'jszip';
import { Eu4Save } from '../model/games/eu4/Eu4Save';

@Injectable({
    providedIn: 'root'
})
export class PdxFileService {

    /**
     * Parses a string using Jomini and returns a Promise of the resulting JSON.
     * @param content The string content to parse.
     */
    public parseContentToJsonPromise(content: string): Promise<any> {
        return Jomini.initialize().then(parser => {
            const parsedData = parser.parseText(content, {}, (q) => q.json());
            return JSON.parse(parsedData);
        });
    }

    importFile(files: File[], callback: (name: string, json: any) => void, errorCallback?: (error: any, message: string) => void) {
        const handleFileRead = async (file: File, content: string) => {
            try {
                const parser = await Jomini.initialize();
                const parsedData = parser.parseText(content, {}, (q) => q.json());
                const json = JSON.parse(parsedData);
                callback(file.name, json);
            } catch (error) {
                if (errorCallback) {
                    const message = `Error parsing file: ${file.name}`;
                    console.error(message, error);
                    // Try to extract offset from error message
                    const errorString = JSON.stringify(error);
                    console.log("Full error object:", errorString);
                    const offsetMatch = errorString.match(/offset:\s*(\d+)/);
                    if (offsetMatch && offsetMatch[1]) {
                        const offset = parseInt(offsetMatch[1], 10);
                        console.error(this.debugOffsetContext(content, offset));
                    } else {
                        console.warn("Could not extract offset from error. Error was:", errorString);
                    }
                    errorCallback(error, message);
                }
            }
        };

        for (let file of files) {
            const reader = new FileReader();
            if (file.name.endsWith('.json')) {
                file.text().then((text) => callback(file.name, JSON.parse(text)));
            } else if (['.zip', '.eu4', '.ck3'].some(ext => file.name.endsWith(ext))) {
                this.import(file, (json) => {
                    if (file.name.endsWith('.ck3')) {
                        this.downloadJson(json, file.name.split(".")[0] + ".json");
                    }
                    callback(file.name, json);
                });
            } else if (file.name.endsWith('.v3')) {
                reader.onload = (e) => {
                    const content = e.target?.result as string;
                    const preprocessed = this.preprocessVic3Content(content);
                    handleFileRead(file, preprocessed);
                };
                reader.readAsText(file);
            } else {
                reader.onload = (e) => handleFileRead(file, e.target?.result as string);
                reader.readAsText(file);
            }
        }
    }

    importFilePromise(file: File) {
        return this.importFilesPromise([file]).then(results => results[0]);
    }

    importFilesPromise(files: File[]): Promise<{ name: string, json: any }[]> {
        const promises = files.map(file => {
            return new Promise<{ name: string, json: any }>((resolve, reject) => {
                const reader = new FileReader();

                const handleFileRead = async (content: string) => {
                    try {
                        const parser = await Jomini.initialize();
                        const parsedData = parser.parseText(content, {}, (q) => q.json());
                        const json = JSON.parse(parsedData);
                        resolve({ name: file.name, json });
                    } catch (error) {
                        const message = `Error parsing file: ${file.name}`;
                        console.error(message, error);
                        // Try to extract offset from error message
                        const errorString = JSON.stringify(error);
                        console.log("Full error object:", errorString);
                        const offsetMatch = errorString.match(/offset:\s*(\d+)/);
                        if (offsetMatch && offsetMatch[1]) {
                            const offset = parseInt(offsetMatch[1], 10);
                            console.error(this.debugOffsetContext(content, offset));
                        } else {
                            console.warn("Could not extract offset from error. Error was:", errorString);
                        }
                        reject({ error, message });
                    }
                };

                if (file.name.endsWith('.json')) {
                    file.text().then(text => resolve({ name: file.name, json: JSON.parse(text) })).catch(error => reject({ error, message: `Error reading file: ${file.name}` }));
                } else if (['.zip', '.ck3'].some(ext => file.name.endsWith(ext))) {
                    this.import(file, json => {
                        resolve({ name: file.name, json });
                    });
                } else if (file.name.endsWith(".eu4")) {
                    this.isZipFile(file).then(isZip => {
                        if (isZip) {
                            this.importZip(file, json =>
                                resolve({ name: file.name, json })
                            );
                        } else {
                            reader.onload = e => handleFileRead(e.target?.result as string);
                            reader.readAsText(file);
                        }
                    }).catch(error =>
                        reject({ error, message: `Failed to detect EU4 save type: ${file.name}` })
                    );
                } else if (file.name.endsWith('.v3')) {
                    this.isZipFile(file).then(isZip => {
                        if (isZip) {
                            console.log("Importing V3 ZIP save:", file.name);
                            this.importZip(file, json =>
                                resolve({ name: file.name, json })
                            );
                        } else {
                            console.log("Importing V3 plain text save:", file.name);
                            reader.onload = e => {
                                const content = e.target?.result as string;
                                const preprocessed = this.preprocessVic3Content(content);
                                handleFileRead(preprocessed);
                            };
                            reader.readAsText(file);
                        }
                    }).catch(error =>
                        reject({ error, message: `Failed to detect V3 save type: ${file.name}` })
                    );
                } else {
                    reader.onload = e => handleFileRead(e.target?.result as string);
                    reader.readAsText(file);
                }
            });
        });

        return Promise.all(promises);
    }

    private import(file: File, callback: (json: any) => void) {
        const zip = new JSZip();
        zip.loadAsync(file).then((zip: any) => {
            return zip.file("gamestate")?.async("uint8array");
        }).then((gamestateData: Uint8Array) => {
            const decoder = new TextDecoder("utf-8");
            const decodedData = decoder.decode(gamestateData);
            return this.importGamestate(decodedData);
        }).then((json: any) => {
            callback(json);
        });
    }

    private importGamestate(gamestateData: string, isVic3: boolean = false) {
        let processedData = gamestateData;
        if (isVic3) {
            processedData = this.preprocessVic3Content(gamestateData);
        }
        return Jomini.initialize().then((parser) => {
            const out = parser.parseText(processedData, {}, (q) => q.json());
            const j = JSON.parse(out);
            return j;
        });
    }


    public downloadJson(json: any, filename: string) {
        console.log("Downloading JSON", json, filename);
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    private async isZipFile(file: File): Promise<boolean> {
        const header = await file.slice(0, 4).arrayBuffer();
        const bytes = new Uint8Array(header);
        return (
            bytes[0] === 0x50 &&
            bytes[1] === 0x4B &&
            bytes[2] === 0x03 &&
            bytes[3] === 0x04
        );
    }

    private async importZip(file: File, callback: (json: any) => void): Promise<void> {
        try {
            const buffer = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(buffer);
            const gamestateFile = zip.file("gamestate");
            if (!gamestateFile) {
                throw new Error("ZIP save missing 'gamestate' entry");
            }
            const gamestateText = await gamestateFile.async("string");
            const isVic3 = file.name.endsWith('.v3');
            const json = await this.importGamestate(gamestateText, isVic3);

            callback(json);
        } catch (error) {
            console.error("ZIP import failed", error);
            throw error;
        }
    }

    async loadEu4SaveFromUrl(url: string): Promise<Eu4Save> {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], url.split('/').pop() || 'eu4-save');
            const namesAndJsons = await this.importFilesPromise([file]);
            const first = namesAndJsons[0];
            const save = new Eu4Save(first.json);
            return save;
        } catch (error) {
            throw new Error(`Failed to load EU4 save from URL: ${error}`);
        }
    }

    private preprocessVic3Content(content: string): string {
        const parts: string[] = [];
        let i = 0;
        let removed = false;
        const pattern = 'migration_buckets';
        const patternLen = pattern.length;
        while (i < content.length) {
            if (i + patternLen + 2 <= content.length && 
                content.substring(i, i + patternLen) === pattern && 
                content[i + patternLen] === '=' &&
                content[i + patternLen + 1] === '{') {
                i += patternLen + 2;
                let braceCount = 1;
                while (i < content.length && braceCount > 0) {
                    if (content[i] === '{') braceCount++;
                    else if (content[i] === '}') braceCount--;
                    i++;
                }
                removed = true;
            } else {
                parts.push(content[i]);
                i++;
            }
        }
        if (removed) {
            console.log("Removed migration_buckets section from V3 save");
        }
        return parts.join('');
    }

    /**
     * Debug helper to display content around a specific offset
     * @param content The string content to debug
     * @param offset The offset position to highlight
     * @returns A formatted debug string showing context around the offset
     */
    private debugOffsetContext(content: string, offset: number): string {
        const contextLength = 100;
        const start = Math.max(0, offset - contextLength);
        const end = Math.min(content.length, offset + contextLength);

        const before = content.substring(start, offset);
        const after = content.substring(offset, end);
        const charAtOffset = content[offset] || 'EOF';

        // Escape special characters for display
        const displayBefore = before.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        const displayAfter = after.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

        const debugOutput = `
════════════════════════════════════════════════════════════
DEBUG: Parsing Error Context at Offset ${offset}
════════════════════════════════════════════════════════════
Character at offset: '${charAtOffset}' (charCode: ${charAtOffset.charCodeAt(0) || 'N/A'})

CONTEXT (100 chars before | HERE | 100 chars after):
${displayBefore}[HERE]${displayAfter}

POINTER:
${' '.repeat(displayBefore.length)}^^^

Line and column estimation:
  Line: ${content.substring(0, offset).split('\n').length}
  Column: ${offset - content.lastIndexOf('\n', offset - 1)}
════════════════════════════════════════════════════════════`;

        return debugOutput;
    }
}