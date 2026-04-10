import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomeAllComponent } from './home-all.component';

describe('HomeAllComponent', () => {
  let component: HomeAllComponent;
  let fixture: ComponentFixture<HomeAllComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeAllComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeAllComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
