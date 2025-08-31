import { Routes } from '@angular/router';
import { ParadoxComponent } from './paradox/paradox.component';
import { LabComponent } from './lab/lab.component';
import { MapComponent } from './map/map.component';
import { MCSignupComponent } from './mcsignup/mcsignup.component';
import { MCAdminComponent } from './mc/mcadmin/mcadmin.component';

export const routes: Routes = [
    { path: '', component: ParadoxComponent },
    { path: 'map', component: MapComponent },
    { path: 'lab', component: LabComponent },
    { path: 'mc/signup', component: MCSignupComponent },
    { path: 'mc/signup/admin', component: MCAdminComponent }
];