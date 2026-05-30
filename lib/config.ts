import { RemovalPolicy } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';

export type EnvName = 'Dev' | 'Test' | 'Prod';

export interface EnvConfig {
    envName: EnvName;
    removalPolicy: RemovalPolicy;
    logRetention: logs.RetentionDays;
    apiErrorRateThreshold: number;
    lambdaErrorThreshold: number;
    enablePaging: boolean;
    fargateDesiredCount: number;
    fargateCpu: number; // 256 = 0.25 vCPU
    fargateMemoryMiB: number;
}

export const ENV_CONFIGS: Record<EnvName, EnvConfig> = {
  Dev: {
    envName: 'Dev',
    removalPolicy: RemovalPolicy.DESTROY,
    logRetention: logs.RetentionDays.ONE_WEEK,
    apiErrorRateThreshold: 50,
    lambdaErrorThreshold: 50,
    enablePaging: false,
    fargateDesiredCount: 1,
    fargateCpu: 256,
    fargateMemoryMiB: 512,
  },
  Test: {
    envName: 'Test',
    removalPolicy: RemovalPolicy.DESTROY,
    logRetention: logs.RetentionDays.TWO_WEEKS,
    apiErrorRateThreshold: 10,
    lambdaErrorThreshold: 10,
    enablePaging: false,
    fargateDesiredCount: 1,
    fargateCpu: 256,
    fargateMemoryMiB: 512,
  },
  Prod: {
    envName: 'Prod',
    removalPolicy: RemovalPolicy.RETAIN,
    logRetention: logs.RetentionDays.ONE_MONTH,
    apiErrorRateThreshold: 5,
    lambdaErrorThreshold: 3,
    enablePaging: true,
    fargateDesiredCount: 2,
    fargateCpu: 512,
    fargateMemoryMiB: 1024,
  },
};