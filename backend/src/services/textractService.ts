import {
  StartDocumentAnalysisCommand,
  StartDocumentAnalysisCommandOutput,
  GetDocumentAnalysisCommand,
  GetDocumentAnalysisCommandOutput,
  AnalyzeDocumentCommand,
  AnalyzeDocumentCommandOutput,
  Block
} from "@aws-sdk/client-textract";

import {
  PutObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";

import { textractClient } from "../config/textract";
import { s3Client } from "../config/s3";

export class TextractService {

  // =========================
  // S3 METHODS
  // =========================

  public static async uploadToS3(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));
  }

  public static async deleteFromS3(
    bucket: string,
    key: string
  ): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  }

  // =========================
  // UTIL
  // =========================

  private static normalizeQueryString(str: string): string {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x00-\x7F]/g, "");
  }

  // =========================
  // TEXTRACT ASYNC JOB
  // =========================

  public static async startAnalysis(
    s3Bucket: string,
    s3Key: string,
    features: string[] = ["LAYOUT"],
    queries?: { Text: string; Alias?: string }[]
  ): Promise<string> {

    const snsTopicArn = process.env.AWS_SNS_TOPIC_ARN;
    const roleArn = process.env.AWS_TEXTRACT_ROLE_ARN;

    const response: StartDocumentAnalysisCommandOutput =
      await textractClient.send(
        new StartDocumentAnalysisCommand({
          DocumentLocation: {
            S3Object: {
              Bucket: s3Bucket,
              Name: s3Key,
            },
          },
          FeatureTypes: features as any,
          QueriesConfig: queries?.length
            ? {
              Queries: queries.map(q => ({
                Text: this.normalizeQueryString(q.Text),
                Alias: q.Alias
                  ? this.normalizeQueryString(q.Alias)
                  : undefined
              }))
            }
            : undefined,
          NotificationChannel:
            snsTopicArn && roleArn
              ? {
                SNSTopicArn: snsTopicArn,
                RoleArn: roleArn,
              }
              : undefined,
        })
      );

    if (!response.JobId) {
      throw new Error("Failed to retrieve JobId from Textract.");
    }

    return response.JobId;
  }

  // =========================
  // TEXTRACT SYNC
  // =========================

  public static async analyzeDocumentSync(
    fileBuffer: Buffer
  ): Promise<Block[]> {

    const response: AnalyzeDocumentCommandOutput =
      await textractClient.send(
        new AnalyzeDocumentCommand({
          Document: { Bytes: fileBuffer },
          FeatureTypes: ["TABLES", "FORMS", "LAYOUT"],
        })
      );

    return response.Blocks ?? [];
  }

  // =========================
  // CORE (REUSÁVEL)
  // =========================

  private static async fetchPaginatedBlocks(
    jobId: string
  ): Promise<Block[]> {

    let nextToken: string | undefined;
    const allBlocks: Block[] = [];

    do {
      const response: GetDocumentAnalysisCommandOutput =
        await textractClient.send(
          new GetDocumentAnalysisCommand({
            JobId: jobId,
            NextToken: nextToken,
          })
        );

      if (response.Blocks) {
        allBlocks.push(...response.Blocks);
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return allBlocks;
  }

  // =========================
  // PUBLIC METHODS
  // =========================

  public static async getBlocks(jobId: string): Promise<Block[]> {
    return this.fetchPaginatedBlocks(jobId);
  }

  public static async getText(jobId: string): Promise<{
    rawText: string;
    totalLines: number;
  }> {

    const blocks = await this.fetchPaginatedBlocks(jobId);

    const lines = blocks
      .filter(b => b.BlockType === "LINE" && b.Text)
      .map(b => b.Text as string);

    return {
      rawText: lines.join("\n"),
      totalLines: lines.length,
    };
  }

  public static async getBlocksAndText(jobId: string): Promise<{
    blocks: Block[];
    rawText: string;
    totalLines: number;
  }> {

    const blocks = await this.fetchPaginatedBlocks(jobId);

    const lines = blocks
      .filter(b => b.BlockType === "LINE" && b.Text)
      .map(b => b.Text as string);

    return {
      blocks,
      rawText: lines.join("\n"),
      totalLines: lines.length,
    };
  }
}