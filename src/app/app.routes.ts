import { Routes } from '@angular/router';
import { ParadoxComponent } from './paradox/paradox.component';
import { LabComponent } from './lab/lab.component';
import { MapComponent } from './map/map.component';
import { MCAdminComponent } from './mc/mcadmin/mcadmin.component';
import { MCSignupComponent } from './mc/mcsignup/mcsignup.component';
import { MegaCampaignComponent } from './mc/mega-campaign/mega-campaign.component';

export const routes: Routes = [
    { path: '', component: ParadoxComponent },
    { path: 'map', component: MapComponent },
    { path: 'lab', component: LabComponent },
    { path: 'mc', component: MegaCampaignComponent},
    { path: 'mc/admin', component: MCAdminComponent }
];