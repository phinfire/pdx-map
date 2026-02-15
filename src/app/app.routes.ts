import { Routes } from '@angular/router';
import { AlliancehelperComponent } from './alliancehelper/alliancehelper.component';
import { CampaignLinesComponent } from './campaign-lines/campaign-lines.component';
import { JominiKioskComponent } from './jomini-kiosk/jomini-kiosk.component';
import { MCAdminComponent } from './mc/admin/mcadmin/mcadmin.component';
import { MegaCampaignComponent } from './mc/mega-campaign/mega-campaign.component';
import { MegaModderComponent } from './modding/mega-modder/mega-modder.component';
import { ParadoxComponent } from './paradox/paradox.component';
import { ResourcemapComponent } from './resourcemap/resourcemap.component';
import { SaveViewSplashComponent } from './saveanalysis/save-view-splash/save-view-splash.component';
import { SavefileadminComponent } from './savefileadmin/savefileadmin.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { MCSignupComponent } from './mc/mcsignup/mcsignup.component';

export const routes: Routes = [
    {
        path: '',
        component: ParadoxComponent,
        children: [
            { path: 'save', component: SaveViewSplashComponent },
            { path: 'save/:saveId', component: SaveViewSplashComponent },
            { path: 'save/:game/:saveId', component: SaveViewSplashComponent },
            { path: 'map', component: ResourcemapComponent },
            { path: 'stonks', component: CampaignLinesComponent },
            { path: 'mc/admin', component: MCAdminComponent },
            { path: 'mc/modder', component: MegaModderComponent },
            { path: 'mc/signup', component: MCSignupComponent },
            { path: 'mc/:campaignId', component: MegaCampaignComponent },
            { path: 'mc', component: MegaCampaignComponent },
            { path: 'jomini', component: JominiKioskComponent },
            { path: 'bloc', component: AlliancehelperComponent },
            { path: 'db', component: SavefileadminComponent },
            { path: '', component: WelcomeComponent }
        ]
    }
];