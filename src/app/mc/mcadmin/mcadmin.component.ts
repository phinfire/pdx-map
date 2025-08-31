import { Component, inject, ViewChild } from '@angular/core';
import { MCSignupService } from '../../services/MCSignupService';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';
import { DiscordFieldComponent } from '../../discord-field/discord-field.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { DiscordUser } from '../../util/DiscordUser';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

@Component({
    selector: 'app-mcadmin',
    imports: [DiscordLoginComponent, DiscordFieldComponent, MatTableModule, MatSortModule],
    templateUrl: './mcadmin.component.html',
    styleUrl: './mcadmin.component.scss'
})
export class MCAdminComponent {

    discordAuthService = inject(DiscordAuthenticationService);
    mcSignupService = inject(MCSignupService);

    protected tableData = new MatTableDataSource<DiscordUser>([]);

    @ViewChild(MatSort) sort!: MatSort;

    ngOnInit() {
        this.tableData.sortingDataAccessor = (item: DiscordUser, property: string): string | number => {
            switch (property) {
                case 'avatar':
                    return item.global_name || item.username;
                case 'name':
                    return item.global_name || item.username;
                case 'global_name':
                    return item.global_name;
                case 'username':
                    return item.username;
                case 'id':
                    return item.id;
                case 'discriminator':
                    return item.discriminator;
                default:
                    return '';
            }
        };
        this.mcSignupService.getAllRegisteredUser$().subscribe(users => {
            console.log('All registered users:', users);
            this.tableData.data = users;
            if (this.sort) {
                this.tableData.sort = this.sort;
            }
        });
    }

    ngAfterViewInit() {
        this.tableData.sort = this.sort;
    }
}
