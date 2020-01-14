import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PageNotFoundComponent } from './core/components/page-not-found/page-not-found.component';
import { StepsEditorComponent } from './steps/components/steps-editor/steps-editor.component';
import { PipelinesEditorComponent } from './pipelines/components/pipelines-editor/pipelines-editor.component';
import { LayoutComponent } from './core/components/layout/layout.component';

const appRoutes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: 'home',
    component: LayoutComponent,
    loadChildren: () =>
      import('./landing/landing.module').then((m) => m.LandingModule),
  },
  {
    path: 'applications-editor',
    component: LayoutComponent,
    loadChildren: () =>
      import('./applications/applications.module').then(
        (m) => m.ApplicationsModule
      ),
  },
  {
    path: 'steps-editor',
    component: LayoutComponent,
    loadChildren: () =>
      import('./steps/steps.module').then((m) => m.StepsModule),
  },
  {
    path: 'pipelines-editor',
    component: LayoutComponent,
    loadChildren: () =>
      import('./pipelines/pipelines.module').then((m) => m.PipelinesModule),
  },
  { path: '**', component: PageNotFoundComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
