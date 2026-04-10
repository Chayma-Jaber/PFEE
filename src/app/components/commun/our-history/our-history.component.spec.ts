import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OurHistoryComponent } from './our-history.component';

describe('OurHistoryComponent', () => {
  let component: OurHistoryComponent;
  let fixture: ComponentFixture<OurHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OurHistoryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OurHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
