import { Injectable } from '@angular/core';
import { Jomini } from 'jomini';
import JSZip from 'jszip';

@Injectable({
    providedIn: 'root'
})
export class PdxFileService {

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
                Jomini.initialize().then((parser) => {
                    reader.onload = (e) => handleFileRead(file, e.target?.result as string);
                    reader.readAsText(file);
                });
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
                        reject({ error, message });
                    }
                };

                if (file.name.endsWith('.json')) {
                    file.text().then(text => resolve({ name: file.name, json: JSON.parse(text) })).catch(error => reject({ error, message: `Error reading file: ${file.name}` }));
                } else if (['.zip', '.eu4', '.ck3'].some(ext => file.name.endsWith(ext))) {
                    this.import(file, json => {
                        if (file.name.endsWith('.ck3')) {
                            this.downloadJson(json, file.name.split(".")[0] + ".json");
                        }
                        resolve({ name: file.name, json });
                    });
                } else if (file.name.endsWith('.v3')) {
                    Jomini.initialize().then(parser => {
                        reader.onload = e => handleFileRead(e.target?.result as string);
                        reader.readAsText(file);
                    }).catch(error => reject({ error, message: `Error initializing Jomini for file: ${file.name}` }));
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
            console.log("Importing file done");
            callback(json);
        });
    }

    private importGamestate(gamestateData: string) {
        const fixedData = gamestateData + "}"
        return Jomini.initialize().then((parser) => {
            const out = parser.parseText(gamestateData, {}, (q) => q.json());
            console.log("Parsing gamestate file done");
            const j = JSON.parse(out);
            return j;
        });
    }

    
    public downloadJson(json: any, filename: string) {
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
