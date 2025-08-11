import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscordLoginComponent } from './discord-login.component';

describe('DiscordLoginComponent', () => {
  let component: DiscordLoginComponent;
  let fixture: ComponentFixture<DiscordLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscordLoginComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiscordLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
