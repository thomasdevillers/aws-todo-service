#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new cdk.App();

new PipelineStack(app, 'TodoServicePipeline', {
  env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  githubOwner: 'thomasdevillers',
  githubRepo: 'aws-todo-service',
  githubBranch: 'main',
  connectionArn: 'arn:aws:codeconnections:eu-north-1:230464733857:connection/86dde3ac-7065-47b9-8fb0-b54af88edb13',
})
