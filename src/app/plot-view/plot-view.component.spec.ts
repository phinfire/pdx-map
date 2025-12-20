import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlotViewComponent } from './plot-view.component';
import { PlotExportService } from './PlotExportService';

describe('PlotViewComponent', () => {
  let component: PlotViewComponent;
  let fixture: ComponentFixture<PlotViewComponent>;

  beforeEach(async () => {
    // Mock PlotExportService to avoid image processing during tests
    const mockExportService = {
      exportPlotAsPNG: jasmine.createSpy('exportPlotAsPNG').and.returnValue(Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [PlotViewComponent],
      providers: [
        { provide: PlotExportService, useValue: mockExportService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlotViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
