import * as L from 'leaflet';
import * as d3 from 'd3';
import { Component, Input, ViewChild } from '@angular/core';
import { ElementRef } from '@angular/core';
import { MapService } from '../map.service';
import { HttpClient } from '@angular/common/http';
import { PdxFileService } from '../services/pdx-file.service';
import { Eu4Save } from '../model/eu4/Eu4Save';
import { IHasKey, MapDataProvider } from './MapDataProvider';

@Component({
    selector: 'app-map',
    imports: [],
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss']
})
export class MapComponent {

    protected static readonly wasteLandColorHex = "#808080";
    private imgSize: [number, number] = [0.8 * 8192, 4096];

    private includedCounties = new Map<string, IHasKey>();

    private map: L.Map | null = null;
    private geoJsonLayer: L.GeoJSON | null = null;
    private showHoverTooltip = true;

    private geoJson: any = {};

    private dataProvider: MapDataProvider = new MapDataProvider(null);

    @ViewChild('mapcontainer') mapContainer!: ElementRef<HTMLDivElement>;

    constructor(private hostElement: ElementRef, private mapService: MapService, private fileService: PdxFileService, private http: HttpClient) {
        /*this.http.get('http://127.0.0.1:5500/public/test.json').subscribe((data) => {
            this.dataProvider.setActiveSave(new Eu4Save(data));
            this.showPerProvinceValue(this.dataProvider.getAvailableValueModes()[0].iconUrl, this.dataProvider.getAvailableValueModes()[0].valueGetter);
        });*/
    }

    ngOnInit() {/*
        this.mapService.fetchEU4GeoJson().subscribe((data) => {
            this.geoJson = data;
        });
        */
        this.hostElement.nativeElement.addEventListener('drop', (event: DragEvent) => {
            event.preventDefault();
            if (event.dataTransfer && event.dataTransfer.files.length > 0) {
                const files = Array.from(event.dataTransfer.files);
                this.fileService.importFile(files, (name, json) => {
                    this.fileService.downloadJson(json, "imported.json");
                });
            }
        });
        this.hostElement.nativeElement.addEventListener('dragover', (event: DragEvent) => {
            event.preventDefault();
        });
    }

    private setupMap(key2color: Map<string, string>, getter: (county: IHasKey) => HTMLElement[]) {
        const ctx = this;
        function style(feature: any) {
            const type = feature.properties.type;
            const key = feature.properties.key + "";
            let typeRGB = MapComponent.wasteLandColorHex;
            if (key2color.has(key)) {
                typeRGB = key2color.get(key)!;
            }
            return { color: "#000000", fillColor: typeRGB, fillOpacity: 1, weight: 1 };
        }

        function highlightFeature(e: any) {
            const key = e.target.feature.properties.key + "";
            if (ctx.includedCounties.has(key)) {
                const layer = e.target;
                layer.setStyle({
                    weight: 5,
                    color: '#666',
                    fillOpacity: 0.7
                });
                layer.bringToFront();
                if (ctx.showHoverTooltip) {
                    ctx.showTooltip(false, e, ctx.includedCounties.get(key)!, getter);
                }
            }
        }
        function onEachFeature(feature: any, layer: any) {
            layer.on({
                mouseover: highlightFeature,
                mouseout: (e: any) => ctx.geoJsonLayer!.resetStyle(e.target)
            }).on('click', (e: any) => {

            });
        }

        setTimeout(() => {
            if (this.map == null) {
                this.map = this.setupMapContainer();
                this.addCustomControls(this.map);
            } else {
                this.geoJsonLayer!.clearLayers();
            }
            this.geoJsonLayer = L.geoJSON(this.geoJson, {
                style: style,
                onEachFeature: onEachFeature
            }).addTo(this.map!);
        }, 0);
    }

    protected showPerProvinceCategory(iconUrl: string, valueGetter: (county: IHasKey) => string, colorGetter: (county: IHasKey) => string) {
        const country2Color = new Map<string, string>();
        for (let county of this.dataProvider.getAllElements()) {
            const color = colorGetter(county);
            country2Color.set(county.getKey(), color);
            this.includedCounties.set(county.getKey(), county);
        }
        this.setupMap(country2Color, (county) => {
            const row1 = document.createElement('div');
            row1.appendChild(document.createTextNode(valueGetter(county)));
            const image = document.createElement('img');
            image.src = iconUrl;
            image.style.height = "1em";
            image.style.width = "auto";
            row1.appendChild(image);
            return [row1];
        });
    }

    protected showPerProvinceValue(iconUrl: string, valueGetter: (county: IHasKey) => number) {
        const color = d3.scaleSequential(d3.interpolateInferno);
        const counties = this.dataProvider.getAllElements();
        const max = counties.map(county => valueGetter(county)).reduce((a, b) => Math.max(a, b), 0);
        const min = counties.map(county => valueGetter(county)).reduce((a, b) => Math.min(a, b), 0);
        const country2Color = new Map<string, string>();
        for (let county of counties) {
            const coded = color((valueGetter(county) - min) / (max - min));
            country2Color.set(county.getKey(), coded);
            this.includedCounties.set(county.getKey(), county);
        }
        this.setupMap(country2Color, (county) => {
            const row1 = document.createElement('div');
            row1.appendChild(document.createTextNode(valueGetter(county).toString()));
            const image = document.createElement('img');
            image.src = iconUrl;
            image.classList.add('tooltip-image');
            row1.appendChild(image);
            return [row1];
        });
    }

    private addCustomControls(map: L.Map) {
        const ctx = this;
        const tooltipToggleControl = L.Control.extend({
            options: {
                position: 'bottomleft'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom tooltip-toggle-control');
                const button = L.DomUtil.create('button', '', container);
                button.innerHTML = ctx.showHoverTooltip ? "Click to disable hover tooltip" : "Click to enable hover tooltip";
                button.title = "Toggle hover tooltip";
                button.onclick = () => {
                    ctx.showHoverTooltip = !ctx.showHoverTooltip;
                    button.innerHTML = ctx.showHoverTooltip ? "Click to disable hover tooltip" : "Click to enable hover tooltip";
                };
                return container;
            }
        });
        
        const customControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom custom-control');
                const makeButton = (iconUrl: string, tooltip: string, onClick: () => void) => {
                    const button = L.DomUtil.create('button', '', container);
                    button.innerHTML = `<img src="${iconUrl}">`;
                    button.title = tooltip;
                    button.onclick = onClick;
                };
                for (let mode of ctx.dataProvider.getAvailableValueModes()) {
                    makeButton(mode.iconUrl, mode.tooltip, () => ctx.showPerProvinceValue(mode.iconUrl, mode.valueGetter));
                }
                for (let mode of ctx.dataProvider.getAvailableCategoryModes()) {
                    makeButton(mode.iconUrl, mode.tooltip, () => ctx.showPerProvinceCategory(mode.iconUrl, mode.valueGetter, mode.colorGetter));
                }
                return container;
            }
        });
        
        const histogramPanelControl = L.Control.extend({
            options: {
                position: 'bottomright'
            },
            onAdd: function () {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom histogram-panel');
                container.innerHTML = '<div id="histogram-container"></div>';
                return container;
            }
        });
        map.addControl(new histogramPanelControl());
        map.addControl(new customControl());
        map.addControl(new tooltipToggleControl());
    }

    private setupMapContainer() {
        const imageBounds: L.LatLngBoundsExpression = [[0, 0], [this.imgSize[1], this.imgSize[0]]];
        const map = L.map(this.mapContainer.nativeElement, {
            crs: L.CRS.Simple,
            minZoom: -3,
            maxZoom: 4,
        });
        map.fitBounds(imageBounds);
        return map;
    }

    private showTooltip(permanent: boolean, event: any, county: IHasKey, getter: (county: IHasKey) => HTMLElement[]) {
        const tooltip = L.tooltip({
            permanent: false,
            direction: 'top',
            className: 'feature-tooltip'
        })
            .setLatLng(event.latlng)
            .addTo(this.geoJsonLayer!);
    
        const div = document.createElement('div');
        const row0 = document.createElement('div');
        row0.style.marginBottom = "0.5em";
        div.appendChild(row0);
        row0.appendChild(document.createTextNode(this.dataProvider.getName(county)));
        for (let element of getter(county)) {
            div.appendChild(element);
        }
        tooltip.getElement()!.appendChild(div);
        event.target.on('mousemove', function (moveEvent: any) {
            tooltip.setLatLng(moveEvent.latlng);
        });
        const ctx = this;
        event.target.on('mouseout', function () {
            ctx.geoJsonLayer!.removeLayer(tooltip);
        });
    }
}
