import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LandingRoutingModule } from './landing-routing.module';
import { LandingComponent } from './components/landing/landing.component';
import { materialDesignModules } from '../shared/material-design-modules';

@NgModule({
  declarations: [LandingComponent],
  imports: [CommonModule, LandingRoutingModule, materialDesignModules],
})
export class LandingModule {}
