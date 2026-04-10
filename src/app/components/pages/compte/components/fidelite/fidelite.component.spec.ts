import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FideliteComponent } from './fidelite.component';

describe('FideliteComponent', () => {
  let component: FideliteComponent;
  let fixture: ComponentFixture<FideliteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FideliteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FideliteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
