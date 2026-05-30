import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { EnvConfig } from './config';

interface DatabaseStackProps extends StackProps {
    config: EnvConfig
}

export class DatabaseStack extends Stack {
    public readonly todosTable: dynamodb.TableV2; // Exposed for use in other stacks

    constructor(scope: Construct, id: string, props: DatabaseStackProps) {
        super(scope, id, props);

        this.todosTable = new dynamodb.TableV2(this, 'TodosTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            removalPolicy: props.config.removalPolicy, // NOT recommended for production code
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: props.config.envName === 'Prod',
            }
        });
    }
}