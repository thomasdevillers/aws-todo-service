import { Stack, StackProps, Stage, StageProps, stringToCloudFormation, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { DatabaseStack } from './database-stack';
import { MessagingStack } from './messaging-stack';
import { AlarmsStack } from './alarm-stack';
import { ApiStack } from './api-stack';
import { ENV_CONFIGS, EnvName } from './config';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';



interface AppStageProps extends StageProps {
    envName: EnvName,
}

class AppStage extends Stage {
    public readonly apiUrlOutput: CfnOutput | undefined;
    constructor(scope: Construct, id: string, props: AppStageProps) {
        super(scope, id, props)

        const config = ENV_CONFIGS[props.envName];

        const db = new DatabaseStack(this, 'TodoDatabase', {config});
        const messaging = new MessagingStack(this, 'TodoMessaging', {config});
        const api = new ApiStack(this, 'TodoApi', {
            todosTable: db.todosTable,
            topic: messaging.topic,
            config,
        })

        new AlarmsStack(this, 'TodoAlarms', {
            config,
            apiFn: api.apiFn,
            workerFn: messaging.workerFn,
            dlq: messaging.dlq,
            httpApi: api.httpApi,
            pagerEmail: this.node.tryGetContext('pagerEmail'),
            pagerPhone: this.node.tryGetContext('pagerPhone'),
        });

        this.apiUrlOutput = api.apiUrlOutput;
    }
}

interface PipelineStackProps extends StackProps {
    githubOwner: string,
    githubRepo: string,
    githubBranch: string,
    connectionArn: string,
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props)

        const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
            pipelineName: 'TodoServicePipeline',
            synth: new pipelines.ShellStep('Synth', {
                input: pipelines.CodePipelineSource.connection(
                    `${props.githubOwner}/${props.githubRepo}`,
                    props.githubBranch,
                    {connectionArn: props.connectionArn},
                ),
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth'
                ],
            }),
        });

        const devStage = new AppStage(this, 'Dev', {envName: 'Dev'});
        pipeline.addStage(devStage, {
            post: [
                new pipelines.ShellStep('DevIntegrationTest', {
                    envFromCfnOutputs: {API_URL: devStage.apiUrlOutput!},
                    commands: ['npm ci', 'npm run integ-test'],
                }),
            ],
        });
        const testStage = new AppStage(this, 'Test', { envName: 'Test' });
        pipeline.addStage(testStage, {
            post: [
                new pipelines.ShellStep('TestIntegrationTest', {
                    envFromCfnOutputs: { API_URL: testStage.apiUrlOutput! },
                    commands: ['npm ci', 'npm run integ-test'],
                }),
            ],
        });

        const prodStage = new AppStage(this, 'Prod', {envName: 'Prod'});
        pipeline.addStage(prodStage, {
            pre: [
                new pipelines.ManualApprovalStep('PromoteToProd', {
                    comment: 'Dev & Test integ tests passed. Approve to deploy to prod.',
                })
            ],
            post: [
                new pipelines.ShellStep('ProdSmokeTest', {
                    envFromCfnOutputs: {API_URL: prodStage.apiUrlOutput!},
                    commands: ['npm ci', 'nom run smoke-test']
                })
            ]
        })

        pipeline.buildPipeline(); //normally done automatically

        const pagerEmail = this.node.tryGetContext("pagerEmail");
        if(pagerEmail){
            const pipelineAlertsTopic = new sns.Topic(this, 'PipelineAlertsTopic');
            pipelineAlertsTopic.addSubscription(new snsSubs.EmailSubscription(pagerEmail));

            new notifications.NotificationRule(this, "PipelineFailures", {
                source: pipeline.pipeline,
                events: [
                    'codepipeline-pipeline-pipeline-execution-failed',
                    'codepipeline-pipeline-manual-approval-needed',
                ],
            targets: [pipelineAlertsTopic],
            })
        }
    } 
}