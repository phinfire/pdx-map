import { HttpClient } from "@angular/common/http";
import { Component, inject, ViewChild } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { firstValueFrom } from "rxjs";
import { Jomini } from "jomini";
import { CK3Service } from "../../services/gamedata/CK3Service";
import { TableColumn } from "../../util/table/TableColumn";
import { Ck3Player } from "../../model/ck3/Player";
import { Ck3Save } from "../../model/Ck3Save";
import { PdxFileService } from "../../services/pdx-file.service";
import { PolygonSelectComponent } from "../viewers/polygon-select/polygon-select.component";
import { ColorConfigProvider } from "../viewers/polygon-select/ColorConfigProvider";
import { makeGeoJsonPolygons } from "../../util/geometry/threeGeometry";
import { MapService } from "../map.service";
import { AssignmentService } from "../mc/AssignmentService";
import { SlabMapViewComponent } from "../slab-map-view/slab-map-view.component";
import { Vic3Save } from "../../model/vic/Vic3Save";
import { Eu4Save } from "../../model/eu4/Eu4Save";
import { LineviewerComponent } from "../lineviewer/lineviewer.component";

@Component({
    selector: 'app-lab',
    imports: [LineviewerComponent],
    templateUrl: './lab.component.html',
    styleUrl: './lab.component.scss'
})
export class LabComponent {

    @ViewChild('viewer') viewerComponent!: SlabMapViewComponent;

    fileService = inject(PdxFileService);
    http = inject(HttpClient);
    ck3Service = inject(CK3Service);

    save: Ck3Save | Eu4Save | null = null;


    async ngOnInit() {
        if (false) {
            try {
                const url = 'http://127.0.0.1:5500/public/mp_Greater_Elbia1705_05_28.eu4';
                const response = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
                const file = new File([response], 'save.eu4', { type: 'application/octet-stream' });
                const result = await this.fileService.importFilePromise(file);
                this.save = new Eu4Save(result.json);
            } catch (error) {
                console.error('Error loading EU4 save file:', error);
            }
        } else {
            /*this.ck3Service.openCk3SaveFromFile("http://localhost:5500/public/Duke_Friedrich_II_of_Lower_Lotharingia_1107_07_25.ck3").subscribe(save => {
            this.save = save;
        });*/
        }
    }
}