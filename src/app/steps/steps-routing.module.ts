import { RouterModule, Routes } from '@angular/router';
import { NgModule } from '@angular/core';
import { StepsEditorComponent } from './components/steps-editor/steps-editor.component';

const routes: Routes = [
  {
    component: StepsEditorComponent,
    path: '',
    pathMatch: 'full',
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StepsRoutingModule {}
