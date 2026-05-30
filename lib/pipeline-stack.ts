import { Stack, StackProps, Stage, StageProps, stringToCloudFormation } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as pipelines from 'aws-cdk-lib/pipelines';
import { DatabaseStack } from './database-stack';
import { MessagingStack } from './messaging-stack';
import { ApiStack } from './api-stack';

class AppStage extends Stage {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props)

        const db = new DatabaseStack(this, 'TodoDatabase');
        const messaging = new MessagingStack(this, 'TodoMessaging');
        new ApiStack(this, 'TodoApi', {
            todosTable: db.todosTable,
            topic: messaging.topic,
        })
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

        pipeline.addStage(new AppStage(this, 'Prod'));
    } 
}