import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { IApplication, IExecution } from '../../../core/models/applications.model';
import {
	DesignerComponent,
	DesignerElement,
	DesignerElementAction,
	DesignerElementAddOutput,
	DesignerModel
} from '../../../designer/components/designer/designer.component';
import { ApplicationsService } from '../../../core/services/applications.service';
import { IPipeline } from '../../../core/models/pipelines.model';
import { PipelinesService } from '../../../core/services/pipelines.service';
import { SharedFunctions } from '../../../shared/utils/shared-functions';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { FormControl } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { SparkConfEditorComponent } from '../spark-conf-editor/spark-conf-editor.component';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { PropertiesEditorModalComponent } from '../../../shared/components/properties-editor/modal/properties-editor-modal.component';
import { PackageObjectsService } from '../../../core/services/package-objects.service';
import { IPackageObject } from '../../../core/models/package-objects.model';
import { CodeEditorComponent } from '../../../code-editor/components/code-editor/code-editor.component';
import { ComponentsEditorComponent } from '../components-editor/components-editor.component';
import { ExecutionEditorComponent } from '../execution-editor/execution-editor.component';

@Component({
	selector: 'app-applications-editor',
	templateUrl: './applications-editor.component.html',
	styleUrls: [
		'./applications-editor.component.css'
	]
})
export class ApplicationsEditorComponent implements OnInit {
	@ViewChild('canvas', { static: false })
	canvas: ElementRef;
	originalApplication: IApplication;
	selectedApplication: IApplication;
	designerModel: DesignerModel = DesignerComponent.newModel();
	applications: IApplication[];
	pipelines: IPipeline[];
	packageObjects: IPackageObject[];
	executionLookup = {};
	addExecutionSubject: Subject<DesignerElement> = new Subject<DesignerElement>();
	addExecutionOutput: Subject<DesignerElementAddOutput> = new Subject<DesignerElementAddOutput>();

	// Chip fields
	separatorKeysCodes: number[] = [
		ENTER,
		COMMA
	];
	stepPackageCtrl = new FormControl();
	requiredParametersCtrl = new FormControl();

	constructor(
		private applicationsService: ApplicationsService,
		private pipelinesService: PipelinesService,
		private packageObjectsService: PackageObjectsService,
		public dialog: MatDialog
	) {}

	ngOnInit(): void {
		this.newApplication();
		this.pipelinesService.getPipelines().subscribe((pipelines: IPipeline[]) => {
			if (pipelines) {
				this.pipelines = pipelines;
			} else {
				this.pipelines = [];
			}
		});
		this.applicationsService.getApplications().subscribe((applications: IApplication[]) => {
			if (applications) {
				this.applications = applications;
			} else {
				this.applications = [];
			}
		});
		this.packageObjectsService.getPackageObjects().subscribe((pkgObjs: IPackageObject[]) => {
			if (pkgObjs) {
				this.packageObjects = pkgObjs;
			} else {
				this.packageObjects = [];
			}
		});
	}

	newApplication() {
		this.originalApplication = {
			applicationProperties: {},
			executions: [],
			globals: {},
			id: '',
			name: '',
			pipelineListener: {
				className: 'com.acxiom.pipeline.DefaultPipelineListener',
				parameters: {}
			},
			pipelineManager: undefined, // This is to ensure that the system will load the application pipelines by default
			pipelineParameters: [],
			requiredParameters: [],
			securityManager: {
				className: 'com.acxiom.pipeline.DefaultPipelineSecurityManager',
				parameters: {}
			},
			sparkConf: {
				kryoClasses: [
					'org.apache.hadoop.io.LongWritable',
					'org.apache.http.client.entity.UrlEncodedFormEntity'
				],
				setOptions: [
					{
						name: 'spark.hadoop.io.compression.codecs',
						value:
							'org.apache.hadoop.io.compress.BZip2Codec,org.apache.hadoop.io.compress.DeflateCodec,' +
							'org.apache.hadoop.io.compress.GzipCodec,org.apache.' +
							'hadoop.io.compress.Lz4Codec,org.apache.hadoop.io.compress.SnappyCodec'
					}
				]
			},
			stepMapper: {
				className: 'com.acxiom.pipeline.DefaultPipelineStepMapper',
				parameters: {}
			},
			stepPackages: [],
			pipelines: []
		};
		this.selectedApplication = JSON.parse(JSON.stringify(this.originalApplication));
	}

	loadApplication(id: string) {
		this.originalApplication = this.applications.find((app) => app.id === id);
		this.selectedApplication = JSON.parse(JSON.stringify(this.originalApplication));
		// Create the model from the executions
		const model = DesignerComponent.newModel();
		// let nodeId;
		this.executionLookup = {};
		// const executions = {};
		this.selectedApplication.executions.forEach((execution) => {
			this.createModelNode(model, execution, -1, -1);
			// nodeId = `designer-node-${model.nodeSeq++}`;
			// executions[execution.id] = execution;
		});
		// Create connections
		const connectedNodes = [];
		let connection;
		this.selectedApplication.executions.forEach((execution) => {
			if (execution.parents) {
				execution.parents.forEach((parent) => {
					if (connectedNodes.indexOf(execution.id) === -1) {
						connectedNodes.push(execution.id);
					}
					connection = model.connections[`${parent}::${execution.id}`];
					if (!connection) {
						connection = {
							sourceNodeId: this.executionLookup[parent],
							targetNodeId: this.executionLookup[execution.id],
							endpoints: []
						};
						model.connections[`${this.executionLookup[parent]}::${this.executionLookup[execution.id]}`] = connection;
					}
					connection.endpoints.push({
						sourceEndPoint: execution.id,
						targetEndPoint: 'input'
					});
				});
			}
		});
		// See if automatic layout needs to be applied
		if (!this.selectedApplication.layout || Object.keys(this.selectedApplication.layout).length === 0) {
			DesignerComponent.performAutoLayout(this.executionLookup, connectedNodes, model);
		}
		this.designerModel = model;
	}

	handleElementAction(action: DesignerElementAction) {
		switch (action.action) {
			case 'editExecution':
				const originalId = action.element.data['id'];
				const dialogRef = this.dialog.open(ExecutionEditorComponent, {
					width: '75%',
					height: '90%',
					data: {
						packageObjects: this.packageObjects,
						pipelines: this.pipelines,
						execution: action.element.data
					}
				});
				dialogRef.afterClosed().subscribe((result) => {
					if (result && result.id !== originalId) {
						action.element.name = result.id;
					}
				});
				break;
			case 'addOutput':
				this.addExecutionOutput.next({
					element: action.element,
					output: `output-${new Date().getTime()}`
				});
		}
	}

	removeStepPackage(pkg: string) {
		const index = this.selectedApplication.stepPackages.indexOf(pkg);
		if (index > -1) {
			this.selectedApplication.stepPackages.splice(index, 1);
		}

		if (this.selectedApplication.stepPackages && this.selectedApplication.stepPackages.length === 0) {
			delete this.selectedApplication.stepPackages;
		}
	}

	addStepPackage(event: MatChipInputEvent) {
		const input = event.input;
		const value = event.value;

		// Add our package
		if ((value || '').trim()) {
			if (!this.selectedApplication.stepPackages) {
				this.selectedApplication.stepPackages = [];
			}
			this.selectedApplication.stepPackages.push(value.trim());
		}

		// Reset the input value
		if (input) {
			input.value = '';
		}

		this.stepPackageCtrl.setValue(null);
	}

	removeRequiredParameter(param: string) {
		const index = this.selectedApplication.requiredParameters.indexOf(param);
		if (index > -1) {
			this.selectedApplication.requiredParameters.splice(index, 1);
		}

		if (this.selectedApplication.requiredParameters && this.selectedApplication.requiredParameters.length === 0) {
			delete this.selectedApplication.requiredParameters;
		}
	}

	addRequiredParameter(event: MatChipInputEvent) {
		const input = event.input;
		const value = event.value;

		// Add our package
		if ((value || '').trim()) {
			if (!this.selectedApplication.requiredParameters) {
				this.selectedApplication.requiredParameters = [];
			}
			this.selectedApplication.requiredParameters.push(value.trim());
		}

		// Reset the input value
		if (input) {
			input.value = '';
		}

		this.requiredParametersCtrl.setValue(null);
	}

	openSparkConfEditor() {
		this.dialog.open(SparkConfEditorComponent, {
			width: '75%',
			height: '90%',
			data: this.selectedApplication
		});
	}

	openPropertiesEditor(mode: string) {
		this.dialog.open(PropertiesEditorModalComponent, {
			width: '75%',
			height: '90%',
			data: {
				allowSpecialParameters: false,
				packageObjects: this.packageObjects,
				propertiesObject:
					mode === 'globals' ? this.selectedApplication.globals : this.selectedApplication.applicationProperties
			}
		});
	}

	openComponentsEditor() {
		this.dialog.open(ComponentsEditorComponent, {
			width: '75%',
			height: '90%',
			data: {
				properties: this.selectedApplication,
				packageObjects: this.packageObjects
			}
		});
	}

	exportApplication() {
		this.dialog.open(CodeEditorComponent, {
			width: '75%',
			height: '90%',
			data: {
				code: JSON.stringify(this.generateApplication(), null, 4),
				language: 'json',
				allowSave: false
			}
		});
	}

	newExecution() {
		const execution: IExecution = {
			globals: {},
			id: 'New_Execution',
			initialPipelineId: '',
			mergeGlobals: false,
			parents: [],
			pipelineListener: {
				className: 'com.acxiom.pipeline.DefaultPipelineListener',
				parameters: {}
			},
			pipelineParameters: [],
			securityManager: {
				className: 'com.acxiom.pipeline.DefaultPipelineSecurityManager',
				parameters: {}
			},
			stepMapper: {
				className: 'com.acxiom.pipeline.DefaultPipelineStepMapper',
				parameters: {}
			}
		};
		let element = this.createDesignerElement(execution, this.selectedApplication.executions);
		const canvasRect = this.canvas.nativeElement.getBoundingClientRect();
		element.layout = {
			x: 100 + canvasRect.x,
			y: 150 + canvasRect.y
		};
		this.addExecutionSubject.next(element);
	}

	private generateApplication() {
		const pipelines = [];
		const pipelineIds = [];
		const executions = [];
		const layout = {};
		const connectionKeys = Object.keys(this.designerModel.connections);
		let execution;
		let pipeline;
		let stepGroup;
		let stepParameter;
		let connection;
		Object.keys(this.designerModel.nodes).forEach((key) => {
			execution = this.designerModel.nodes[key].data.data;
			layout[execution.id] = {
				x: this.designerModel.nodes[key].x,
				y: this.designerModel.nodes[key].y
			};
			executions.push(execution);
			execution.parents = [];
			connectionKeys.forEach((connectionKey) => {
				connection = this.designerModel.connections[connectionKey];
				if (connection.targetNodeId === key) {
					execution.parents.push(this.designerModel.nodes[connection.sourceNodeId].data['name']);
				}
			});
			if (execution.pipelineIds) {
				execution.pipelineIds.forEach((id) => {
					if (pipelineIds.indexOf(id) === -1) {
						pipeline = this.pipelines.find((pipeline) => pipeline.id === id);
						pipelines.push(pipeline);
						pipelineIds.push(id);
						pipeline.steps.forEach((step) => {
							if (step.type === 'step-group') {
								stepParameter = step.params.find((p) => p.name === 'pipelineId');
								if (stepParameter && stepParameter.value && stepParameter.value.trim().length > 0) {
									this.setGlobalPipeline(stepParameter.value, pipelineIds, pipelines);
								} else {
									stepParameter = step.params.find((p) => p.name === 'pipeline');
									if (
										stepParameter &&
										stepParameter.type === 'pipeline' &&
										stepParameter.value &&
										stepParameter.value.trim().length > 0
									) {
										this.setGlobalPipeline(stepParameter.value.substring(0), pipelineIds, pipelines);
									}
								}
							}
						});
					}
				});
			}
		});
		this.selectedApplication.pipelines = pipelines;
		this.selectedApplication.executions = executions;
		this.selectedApplication.layout = layout;
		return this.selectedApplication;
	}

	private setGlobalPipeline(id: string, pipelineIds: string[], pipelines: IPipeline[]) {
		if (!id) {
			return;
		}
		const pipelineId = id.trim();
		if (pipelineIds.indexOf(pipelineId) === -1) {
			const pipeline = this.pipelines.find((pipeline) => pipeline.id === pipelineId);
			pipelines.push(pipeline);
			pipelineIds.push(pipelineId);
		}
	}

	private createModelNode(model, execution, x = -1, y = -1) {
		const nodeId = `designer-node-${model.nodeSeq++}`;
		model.nodes[nodeId] = {
			data: this.createDesignerElement(execution, this.selectedApplication.executions),
			x:
				this.selectedApplication.layout && this.selectedApplication.layout[execution.id].x
					? this.selectedApplication.layout[execution.id].x
					: x,
			y:
				this.selectedApplication.layout && this.selectedApplication.layout[execution.id].y
					? this.selectedApplication.layout[execution.id].y
					: y
		};
		this.executionLookup[execution.id] = nodeId;
	}

	private createDesignerElement(execution: IExecution, executions: IExecution[]): DesignerElement {
		return {
			name: execution.id,
			tooltip: execution.id,
			icon: SharedFunctions.getMaterialIconName('execution'),
			input: true,
			outputs: this.generateOutputs(execution, executions),
			data: execution,
			event: null,
			style: null,
			actions: [
				{
					displayName: 'Edit',
					action: 'editExecution',
					enableFunction: () => true
				},
				{
					displayName: 'Add Output',
					action: 'addOutput',
					enableFunction: () => true
				}
			]
		};
	}

	private generateOutputs(execution: IExecution, executions: IExecution[]) {
		const outputs = [];
		executions.forEach((exec) => {
			if (exec.parents && exec.parents.indexOf(execution.id) !== -1) {
				outputs.push(exec.id);
			}
		});
		return outputs;
	}
}
