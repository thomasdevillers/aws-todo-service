import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DatabaseStack extends Stack {
    public readonly todosTable: dynamodb.TableV2; // Exposed for use in other stacks

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.todosTable = new dynamodb.TableV2(this, 'TodosTable', {
            partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
            removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
        });
    }
}