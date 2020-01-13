import { RouterModule, Routes } from '@angular/router';
import { ApplicationsEditorComponent } from './components/applications-editor/applications-editor.component';
import { NgModule } from '@angular/core';

const routes: Routes = [
  {
    component: ApplicationsEditorComponent,
    path: '',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ApplicationsRoutingModule {}
