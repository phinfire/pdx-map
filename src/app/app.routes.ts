import { Routes } from '@angular/router';
import { ParadoxComponent } from './paradox/paradox.component';
import { MapComponent } from './map/map/map.component';
import { MCAdminComponent } from './mc/mcadmin/mcadmin.component';
import { MegaCampaignComponent } from './mc/mega-campaign/mega-campaign.component';
import { SaveViewSplashComponent } from './save-view-splash/save-view-splash.component';
import { LineviewerComponent } from './lineviewer/lineviewer.component';
import { MegaModderComponent } from './modding/mega-modder/mega-modder.component';
import { JominiKioskComponent } from './jomini-kiosk/jomini-kiosk.component';

export const routes: Routes = [
    {
        path: '',
        component: ParadoxComponent,
        children: [
            { path: 'save', component: SaveViewSplashComponent },
            { path: 'map', component: MapComponent },
            { path: 'stonks', component: LineviewerComponent },
            { path: 'mc', component: MegaCampaignComponent },
            { path: 'mc/admin', component: MCAdminComponent },
            { path: 'mc/modder', component: MegaModderComponent },
            { path: 'jomini', component: JominiKioskComponent }
        ]
    }
];