import { async, ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { BinReportPage } from './bin-report.page';

describe('BinReportPage', () => {
  let component: BinReportPage;
  let fixture: ComponentFixture<BinReportPage>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BinReportPage ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(BinReportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
