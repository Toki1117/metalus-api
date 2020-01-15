import { Component, Input, OnInit } from '@angular/core';
import { PackageObjectsService } from '../../../core/services/package-objects.service';
import { IPackageObject } from '../../../core/models/package-objects.model';
import { IPipeline, IPipelineStep, IPipelineStepParam } from '../../../core/models/pipelines.model';
import { PipelinesService } from '../../../core/services/pipelines.service';
import {
	DesignerComponent,
	DesignerElement,
	DesignerElementAction,
	DesignerModel
} from '../../../designer/components/designer/designer.component';
import { DndDropEvent } from 'ngx-drag-drop';
import { Subject } from 'rxjs';
import { NameDialogComponent } from '../../../shared/components/name-dialog/name-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { StepsService } from '../../../steps/steps.service';
import { IStep, StaticSteps } from '../../../steps/steps.model';
import { CodeEditorComponent } from '../../../code-editor/components/code-editor/code-editor.component';
import { WaitModalComponent } from '../../../shared/components/wait-modal/wait-modal.component';
import { diff } from 'deep-object-diff';
import { ErrorModalComponent } from '../../../shared/components/error-modal/error-modal.component';
import * as Ajv from 'ajv';
import { ConfirmationModalComponent } from '../../../shared/components/confirmation/confirmation-modal.component';
import { StepGroupProperty } from '../pipeline-parameter/pipeline-parameter.component';
import { SharedFunctions } from '../../../shared/utils/shared-functions';
import { DesignerPreviewComponent } from '../../../designer/components/designer-preview/designer-preview.component';

@Component({
	selector: 'app-pipelines-editor',
	templateUrl: './pipelines-editor.component.html',
	styleUrls: [
		'./pipelines-editor.component.css'
	]
})
export class PipelinesEditorComponent implements OnInit {
	packageObjects: IPackageObject[];
	pipelines: IPipeline[];
	stepGroups: IPipeline[];
	steps: IStep[];
	selectedPipeline: IPipeline;
	_pipeline: IPipeline;
	selectedStep: IPipelineStep;
	selectedElement: DesignerElement;
	designerModel: DesignerModel = DesignerComponent.newModel();
	dndSubject: Subject<DesignerElement> = new Subject<DesignerElement>();
	stepLookup = {};
	typeAhead: string[] = [];
	pipelineValidator;
	stepGroup: StepGroupProperty = { enabled: false };

	constructor(
		private stepsService: StepsService,
		private pipelinesService: PipelinesService,
		private packageObjectsService: PackageObjectsService,
		public dialog: MatDialog
	) {}

	ngOnInit(): void {
		this.newPipeline();
		this.newStep();
		this.stepsService.getSteps().subscribe((steps: IStep[]) => {
			steps.push(StaticSteps.FORK_STEP);
			steps.push(StaticSteps.JOIN_STEP);
			steps.push(StaticSteps.STEP_GROUP);
			this.steps = steps;
		});

		this.pipelinesService.getPipelines().subscribe((pipelines: IPipeline[]) => {
			if (pipelines) {
				this.pipelines = pipelines;
				this.stepGroups = pipelines.filter((p) => p.category === 'step-group');
			} else {
				this.pipelines = [];
				this.stepGroups = [];
			}
		});

		this.packageObjectsService.getPackageObjects().subscribe((pkgObjs: IPackageObject[]) => {
			this.packageObjects = pkgObjs;
		});

		this.pipelinesService.getPipelineSchema().subscribe((schema) => {
			const ajv = new Ajv({ allErrors: true });
			this.stepsService.getStepSchema().subscribe((stepSchema) => {
				this.pipelineValidator = ajv
					.addSchema(stepSchema, 'stepSchema')
					.addSchema(schema)
					.compile(schema.definitions.BasePipeline);
			});
		});
	}

	@Input()
	set step(step: IPipelineStep) {
		if (step) {
			let localStep = this.selectedPipeline.steps.find((s) => s.id === step.id);
			if (localStep) {
				this.selectedStep = localStep;
			} else {
				this.newStep();
			}
		} else {
			this.newStep();
		}
	}

	newPipeline() {
		this._pipeline = {
			name: '',
			steps: [],
			id: '',
			category: 'pipeline'
		};
		this.selectedPipeline = JSON.parse(JSON.stringify(this._pipeline));
		this.loadPipelineToDesigner();
	}

	newStep() {
		this.selectedStep = {
			stepId: '',
			executeIfEmpty: '',
			nextStepId: '',
			category: '',
			description: '',
			displayName: '',
			id: '',
			params: [],
			type: '',
			engineMeta: {
				pkg: '',
				spark: '',
				stepResults: []
			}
		};
	}

	stepSelected(data: DesignerElement) {
		this.selectedStep = data.data as IPipelineStep;
		this.selectedElement = data;
		this.configureStepGroup();
		this.typeAhead = [];
		const nodeId = this.stepLookup[data.name];
		if (nodeId) {
			this.addNodeToTypeAhead(nodeId, this.typeAhead);
		}
	}

	/**
   * This method will handle changes to the id and ensure element name gets the change.
   */
	handleIdChange() {
		if (this.selectedElement) {
			const id = this.selectedStep.id.replace(' ', '_');
			this.stepLookup[id] = this.stepLookup[this.selectedElement.name];
			delete this.stepLookup[this.selectedElement.name];
			this.selectedElement.name = id;
		}
	}

	handleParameterUpdate(name: string, parameter: IPipelineStepParam) {
		if (name === 'executeIfEmpty') {
			this.selectedStep.executeIfEmpty = parameter.value;
		}
		this.configureStepGroup();
	}

	addStep(event: DndDropEvent) {
		const dialogRef = this.dialog.open(NameDialogComponent, {
			width: '25%',
			height: '25%',
			data: { name: '' }
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result && result.trim().length > 0) {
				const id = result as string;
				const step = JSON.parse(JSON.stringify(event.data));
				// Switch the id and stepId
				step.stepId = step.id;
				step.id = id.replace(' ', '_');
				this.dndSubject.next(this.createDesignerElement(step, event));
			}
		});
	}

	loadPipeline(id: string) {
		if (id === this.selectedPipeline.id) {
			return;
		}
		const newPipeline = this.generatePipeline();
		// Cannot diff the pipeline since step orders could have changed
		if (this.hasPipelineChanged(newPipeline)) {
			const dialogRef = this.dialog.open(ConfirmationModalComponent, {
				width: '450px',
				height: '200px',
				data: { message: 'You have unsaved changes to the current pipeline. Would you like to continue?' }
			});

			dialogRef.afterClosed().subscribe((confirmation) => {
				if (confirmation) {
					this.handleLoadPipeline(id);
				}
			});
		} else {
			this.handleLoadPipeline(id);
		}
	}

	cancelPipelineChange() {
		if (this.selectedPipeline.id) {
			this.loadPipeline(this.selectedPipeline.id);
		} else {
			this.newPipeline();
		}
	}

	exportPipeline() {
		this.dialog.open(CodeEditorComponent, {
			width: '75%',
			height: '90%',
			data: {
				code: JSON.stringify(this.generatePipeline(), null, 4),
				language: 'json',
				allowSave: false
			}
		});
	}

	importPipeline() {
		const dialogRef = this.dialog.open(CodeEditorComponent, {
			width: '75%',
			height: '90%',
			data: {
				code: '',
				language: 'json',
				allowSave: true
			}
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result && result.code.trim().length > 0) {
				const pipeline = JSON.parse(result.code);
				delete pipeline._id;
				this._pipeline = pipeline;
				this.selectedPipeline = JSON.parse(JSON.stringify(pipeline));
				this.loadPipelineToDesigner();
			}
		});
	}

	savePipeline() {
		const dialogRef = this.dialog.open(WaitModalComponent, {
			width: '25%',
			height: '25%'
		});
		const newPipeline = this.generatePipeline();
		const stepValidations = this.validatePipelineSteps(newPipeline);
		if (!this.pipelineValidator(newPipeline) || stepValidations.length > 0) {
			const error = {
				message: ''
			};
			stepValidations.forEach((e) => (error.message = `${error.message}${e}\n`));
			if (this.pipelineValidator.errors && this.pipelineValidator.errors.length > 0) {
				this.pipelineValidator.errors.forEach((err) => {
					error.message = `${error.message}${err.dataPath.substring(1)} ${err.message}\n`;
				});
			}
			this.handleError(error, dialogRef);
		} else {
			let observable;
			if (this.selectedPipeline.id && this.pipelines.findIndex((p) => p.id === this.selectedPipeline.id)) {
				observable = this.pipelinesService.updatePipeline(newPipeline);
			} else {
				observable = this.pipelinesService.addPipeline(newPipeline);
			}
			observable.subscribe(
				(pipeline: IPipeline) => {
					this._pipeline = pipeline;
					this.selectedPipeline = JSON.parse(JSON.stringify(pipeline));
					let index = this.pipelines.findIndex((s) => s.id === this.selectedPipeline.id);
					if (index === -1) {
						this.pipelines.push(this.selectedPipeline);
					} else {
						this.pipelines[index] = this.selectedPipeline;
					}
					if (pipeline.category === 'step-group') {
						index = this.stepGroups.findIndex((s) => s.id === this.selectedPipeline.id);
						if (index === -1) {
							this.stepGroups.push(this.selectedPipeline);
						} else {
							this.stepGroups[index] = this.selectedPipeline;
						}
					}
					// Change the reference to force the selector to refresh
					this.pipelines = [
						...this.pipelines
					];
					this.stepGroups = [
						...this.stepGroups
					];
					dialogRef.close();
				},
				(error) => this.handleError(error, dialogRef)
			);
		}
	}

	deletePipeline() {
		const dialogRef = this.dialog.open(ConfirmationModalComponent, {
			width: '450px',
			height: '200px',
			data: { message: 'Are you sure you wish to permanently delete this pipeline?' }
		});

		dialogRef.afterClosed().subscribe(
			(confirmation) => {
				if (confirmation) {
					this.pipelinesService.deletePipeline(this.selectedPipeline).subscribe((result) => {
						if (result) {
							const index = this.pipelines.findIndex((s) => s.id === this.selectedPipeline.id);
							if (index > -1) {
								this.pipelines.splice(index, 1);
								this.newPipeline();
								// Change the reference to force the selector to refresh
								this.pipelines = [
									...this.pipelines
								];
							}
						}
					});
				}
			},
			(error) => this.handleError(error, dialogRef)
		);
	}

	copyPipeline() {
		if (this.hasPipelineChanged(this.selectedPipeline)) {
			const dialogRef = this.dialog.open(ConfirmationModalComponent, {
				width: '450px',
				height: '200px',
				data: { message: 'You have unsaved changes to the current pipeline. Would you like to continue?' }
			});

			dialogRef.afterClosed().subscribe((confirmation) => {
				if (confirmation) {
					this.handleCopyPipeline();
				}
			});
		} else {
			this.handleCopyPipeline();
		}
	}

	handleElementAction(action: DesignerElementAction) {
		switch (action.action) {
			case 'showPipeline':
				// TODO Show something to the user letting them know we can't determine the pipelineId
				if (action.element.data['type'] === 'step-group') {
					const pipeline = this.getPipeline(<IPipelineStep>action.element.data);
					if (pipeline) {
						const model = this.generateModelFromPipeline(pipeline);
						this.dialog.open(DesignerPreviewComponent, {
							width: '75%',
							height: '90%',
							data: model
						});
					}
				}
				break;
			default:
		}
	}

	private createDesignerElement(step: IPipelineStep, event) {
		let actions = [];
		if (step.type === 'step-group') {
			actions.push({
				displayName: 'Show pipeline',
				action: 'showPipeline',
				enableFunction: () => {
					return this.getPipeline(step);
				}
			});
		}
		return {
			name: step.id,
			tooltip: step.description,
			icon: SharedFunctions.getMaterialIconName(step.type),
			input: true,
			outputs: this.generateOutputs(step),
			data: step,
			event,
			style: step.type === 'step-group' ? 'designer-node-step-group' : null,
			actions
		};
	}

	private addNodeToTypeAhead(nodeId, typeAhead) {
		const parents = Object.values(this.designerModel.connections).filter((c) => c.targetNodeId === nodeId);
		if (parents && parents.length > 0) {
			let stepId;
			parents.forEach((p) => {
				stepId = this.designerModel.nodes[p.sourceNodeId].data.name;
				if (typeAhead.indexOf(stepId) === -1) {
					typeAhead.push(stepId);
				}
				this.addNodeToTypeAhead(p.sourceNodeId, typeAhead);
			});
		}
	}

	private configureStepGroup() {
		if (this.selectedStep.type === 'step-group') {
			let pipeline = this.getPipeline(this.selectedStep);
			this.stepGroup = {
				enabled: true,
				pipeline: pipeline
			};
		} else {
			this.stepGroup = {
				enabled: false
			};
		}
	}

	private getPipeline(step: IPipelineStep) {
		let pipelineId;
		let pipeline;
		let param = step.params.find((p) => p.name === 'pipelineId');
		let value = SharedFunctions.getParameterValue(param);
		if (value) {
			pipelineId = PipelinesEditorComponent.getPipelineId(value);
		}

		if (!pipelineId || pipelineId.trim().length === 0) {
			param = step.params.find((p) => p.name === 'pipeline');
			if (param) {
				value = SharedFunctions.getParameterValue(param);
				switch (typeof value) {
					case 'object':
						if (param.className) {
							pipeline = value;
							pipelineId = null;
						}
						break;
					case 'string':
						const p = value.split('||').filter((v) => v.trim().indexOf('&') === 0)[0];
						pipelineId = PipelinesEditorComponent.getPipelineId(p);
						break;
				}
			}
		}

		pipeline = this.pipelines.find((p) => p.id === pipelineId);
		return pipeline;
	}

	private static getPipelineId(value: string) {
		if (SharedFunctions.getType(value, '') === 'pipeline') {
			return value.substring(1);
		} else {
			return value;
		}
	}

	private generateOutputs(step: IPipelineStep) {
		let outputs = [];
		if (step.type.toLocaleLowerCase() === 'branch') {
			step.params.forEach((p) => {
				if (p.type.toLocaleLowerCase() === 'result') {
					outputs.push(p.name);
				}
			});
		} else {
			outputs.push('output');
		}
		return outputs;
	}

	private hasPipelineChanged(newPipeline) {
		let changed = this._pipeline.steps.length !== newPipeline.steps.length;
		let originalStep;
		newPipeline.steps.forEach((step) => {
			originalStep = this._pipeline.steps.find((s) => s.id === step.id);
			if (!originalStep) {
				changed = true;
			} else {
				if (Object.entries(diff(originalStep, step)).length !== 0) {
					changed = true;
				}
			}
		});
		return this._pipeline.name !== newPipeline.name || changed || this._pipeline.category !== newPipeline.category;
	}

	private handleLoadPipeline(id: string) {
		this._pipeline = this.pipelines.find((p) => p.id === id);
		this.selectedPipeline = JSON.parse(JSON.stringify(this._pipeline));
		this.loadPipelineToDesigner();
	}

	private loadPipelineToDesigner() {
		this.designerModel = this.generateModelFromPipeline(this.selectedPipeline);
	}

	private generateModelFromPipeline(pipeline: IPipeline) {
		const model = DesignerComponent.newModel();
		let nodeId;
		this.stepLookup = {};
		pipeline.steps.forEach((step) => {
			nodeId = `designer-node-${model.nodeSeq++}`;
			model.nodes[nodeId] = {
				data: this.createDesignerElement(step, null),
				x: pipeline.layout && pipeline.layout[step.id].x ? pipeline.layout[step.id].x : -1,
				y: pipeline.layout && pipeline.layout[step.id].y ? pipeline.layout[step.id].y : -1
			};
			this.stepLookup[step.id] = nodeId;
		});
		// Add connections
		let connectedNodes = [];
		pipeline.steps.forEach((step) => {
			if (step.type !== 'branch' && step.nextStepId) {
				model.connections[`${this.stepLookup[step.id]}::${this.stepLookup[step.nextStepId]}`] = {
					sourceNodeId: this.stepLookup[step.id],
					targetNodeId: this.stepLookup[step.nextStepId],
					endpoints: [
						{
							sourceEndPoint: 'output',
							targetEndPoint: 'input'
						}
					]
				};
				connectedNodes.push(step.nextStepId);
			} else {
				let connection;
				step.params.filter((p) => p.type.toLowerCase() === 'result').forEach((output) => {
					if (output.value) {
						connectedNodes.push(output.value);
						connection = model.connections[`${this.stepLookup[step.id]}::${this.stepLookup[output.value]}`];
						if (!connection) {
							connection = {
								sourceNodeId: this.stepLookup[step.id],
								targetNodeId: this.stepLookup[output.value],
								endpoints: []
							};
							model.connections[`${this.stepLookup[step.id]}::${this.stepLookup[output.value]}`] = connection;
						}
						connection.endpoints.push({
							sourceEndPoint: output.name,
							targetEndPoint: 'input'
						});
					}
				});
			}
		});
		// See if automatic layout needs to be applied
		if (!pipeline.layout || Object.keys(pipeline.layout).length === 0) {
			DesignerComponent.performAutoLayout(this.stepLookup, connectedNodes, model);
		}
		return model;
	}

	private handleCopyPipeline() {
		const dialogRef = this.dialog.open(NameDialogComponent, {
			width: '25%',
			height: '25%',
			data: { name: `Copy of ${this.selectedPipeline.name}` }
		});
		dialogRef.afterClosed().subscribe((result) => {
			if (result && result.trim().length > 0) {
				const newpipeline = JSON.parse(JSON.stringify(this.selectedPipeline));
				delete newpipeline['_id'];
				delete newpipeline.id;
				newpipeline.name = result as string;
				this.selectedPipeline = newpipeline;
				this._pipeline = {
					name: '',
					steps: [],
					id: '',
					category: 'pipeline'
				};
				this.loadPipelineToDesigner();
			}
		});
	}

	private validatePipelineSteps(pipeline: IPipeline): String[] {
		const errors = [];
		if (pipeline.steps.length > 0) {
			pipeline.steps.forEach((step) => {
				if (step.params && step.params.length > 0) {
					step.params.forEach((param) => {
						if (param.required && (!param.value || (param.type !== 'object' && param.value.trim().length === 0))) {
							errors.push(`Step ${step.id} has a required parameter ${param.name} that is missing a value`);
						}
					});
				}
			});
		}
		return errors;
	}

	private handleError(error, dialogRef) {
		let message;
		if (error.error instanceof ErrorEvent) {
			// A client-side or network error occurred. Handle it accordingly.
			message = error.error.message;
		} else {
			message = error.message;
		}
		dialogRef.close();
		this.dialog.open(ErrorModalComponent, {
			width: '450px',
			height: '300px',
			data: { message }
		});
	}

	private generatePipeline(): IPipeline {
		const targetIds = Object.values(this.designerModel.connections).map((conn) => conn.targetNodeId);
		const nodeIds = Object.keys(this.designerModel.nodes).filter((key) => targetIds.indexOf(key) === -1);
		const rootNode = this.designerModel.nodes[nodeIds[0]];
		const pipeline = {
			id: this.selectedPipeline.id,
			name: this.selectedPipeline.name,
			category: this.selectedPipeline.category,
			layout: {},
			steps: []
		};
		if (this.selectedPipeline.id) {
			pipeline['creationDate'] = this.selectedPipeline['creationDate'];
			pipeline['modifiedDate'] = this.selectedPipeline['modifiedDate'];
		}
		this.addNodeToPipeline(rootNode, pipeline);
		return pipeline;
	}

	private addNodeToPipeline(node, pipeline) {
		if (!node) {
			return;
		}
		const nodeId = Object.keys(this.designerModel.nodes).find(
			(key) => this.designerModel.nodes[key].data.name === node.data.name
		);
		const step = node.data.data;
		delete step._id;
		PipelinesEditorComponent.adjustStepParameterType(step);
		if (pipeline.steps.findIndex((s) => s.id === step.id) === -1) {
			pipeline.steps.push(step);
			pipeline.layout[step.id] = {
				x: node.x,
				y: node.y
			};
			const children = Object.values(this.designerModel.connections).filter((conn) => conn.sourceNodeId === nodeId);
			if (children.length > 0) {
				if (step.type === 'branch') {
					let childNode;
					delete step.nextStepId;
					children.forEach((child) => {
						childNode = this.designerModel.nodes[child.targetNodeId];
						child.endpoints.forEach((ep) => {
							step.params.find((p) => p.name === ep.sourceEndPoint).value = childNode.data.name;
							this.addNodeToPipeline(childNode, pipeline);
						});
					});
				} else {
					const childNode = this.designerModel.nodes[children[0].targetNodeId];
					step.nextStepId = childNode.data.data.id;
					this.addNodeToPipeline(childNode, pipeline);
				}
			} else {
				delete step.nextStepId;
			}
		}
	}

	private static adjustStepParameterType(step: IPipelineStep) {
		if (step.params) {
			step.params.forEach((param) => {
				switch (param.type) {
					case 'global':
					case 'runtime':
					case 'pipeline':
					case 'step':
					case 'secondary':
						param.type = 'text';
						break;
					default:
				}
			});
		}
	}
}
