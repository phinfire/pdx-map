import { Injectable } from '@angular/core';
import { Jomini } from 'jomini';
import JSZip from 'jszip';

@Injectable({
    providedIn: 'root'
})
export class PdxFileService {

    importFile(files: File[], callback: (name: string, json: any) => void, errorCallback?: (error: any, messag: string) => void) {
        for (let file of files) {
            if (file.name.endsWith('.json')) {
                file.text().then((text) => {
                    callback(file.name, JSON.parse(text));
                });
            } else if (file.name.endsWith('.zip') || file.name.endsWith('.eu4')) {
                this.import(file, (json) => {
                    callback(file.name, json);
                });
            } else if (file.name.endsWith('.v3')) {
                Jomini.initialize().then((parser) => {
                    const reader = new FileReader();
                    reader.onload = async (e) => {
                        const content = e.target?.result as string;
                        try {
                            const parsedData = parser.parseText(content, {}, (q) => q.json());
                            const json = JSON.parse(parsedData);
                            callback(file.name, json);
                            //this.downloadJson(json, file.name.split(".")[0] + ".json");
                        } catch (error) {
                            if (errorCallback) {
                                const message = "Error parsing vic3 save file, are you sure this is plain text?";
                                console.error(message, error);
                                errorCallback(error, message);
                            }
                        }
                    };
                    reader.readAsText(file);
                });
            } else if (file.name.endsWith('.ck3')) {
                this.import(file, (json) => {
                    this.downloadJson(json, file.name.split(".")[0] + ".json");
                });
            } else {
                //console.warn('Dropped file is not a save file: ' + file.name);
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const content = e.target?.result as string;
                    try {
                        const parser = await Jomini.initialize();
                        const parsedData = parser.parseText(content, {}, (q) => q.json());
                        const json = JSON.parse(parsedData);
                        callback(file.name, json);
                        //this.downloadJson(json, file.name.split(".")[0] + ".json");
                    } catch (error) {
                        console.error('Error parsing file:', error);
                    }
                };
                reader.readAsText(file);
            }
        }
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

    private import(file: File, callback: (json: any) => void) {
        console.log("Importing file " + file.name);
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
        console.log("Parsing gamestate file");
        const fixedData = gamestateData + "}"
        return Jomini.initialize().then((parser) => {
            const out = parser.parseText(gamestateData, {}, (q) => q.json());
            console.log("Parsing gamestate file done");
            const j = JSON.parse(out);
            return j;
        });
    }
}
