import { 
  StartDocumentAnalysisCommand, 
  GetDocumentAnalysisCommand, 
  AnalyzeDocumentCommand,
  Block 
} from "@aws-sdk/client-textract";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { textractClient } from "../config/textract";
import { s3Client } from "../config/s3";

export class TextractService {
  /**
   * Uploads file buffer to temporary S3 bucket.
   */
  public static async uploadToS3(bucket: string, key: string, buffer: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
  }

  /**
   * Deletes temporary file from S3.
   */
  public static async deleteFromS3(bucket: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    await s3Client.send(command);
  }

  /**
   * Starts an asynchronous Textract document analysis job (with optional custom feature types).
   */
  public static async startAnalysis(s3Bucket: string, s3Key: string, features: string[] = ["LAYOUT"]): Promise<string> {
    const snsTopicArn = process.env.AWS_SNS_TOPIC_ARN;
    const roleArn = process.env.AWS_TEXTRACT_ROLE_ARN;

    // Se as variáveis de notificação existirem, usa SNS/SQS. Se não, permite fluxo assíncrono padrão.
    const command = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      FeatureTypes: features as any,
      NotificationChannel: snsTopicArn && roleArn ? {
        SNSTopicArn: snsTopicArn,
        RoleArn: roleArn,
      } : undefined,
    });

    const response = await textractClient.send(command);
    if (!response.JobId) {
      throw new Error("Failed to retrieve JobId from Textract StartDocumentAnalysisCommand.");
    }

    return response.JobId;
  }

  /**
   * Performs a synchronous direct-upload document analysis from a file buffer (PDF, PNG, JPEG).
   */
  public static async analyzeDocumentSync(fileBuffer: Buffer): Promise<Block[]> {
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: fileBuffer,
      },
      FeatureTypes: ["TABLES", "FORMS", "LAYOUT"],
    });

    const response = await textractClient.send(command);
    return response.Blocks || [];
  }

  /**
   * Retrieves all Blocks paginated from a completed Textract Job ID
   */
  public static async getFullBlocksList(jobId: string): Promise<Block[]> {
    let nextToken: string | undefined = undefined;
    const allBlocks: Block[] = [];

    do {
      const command: GetDocumentAnalysisCommand = new GetDocumentAnalysisCommand({
        JobId: jobId,
        NextToken: nextToken,
      });

      const response = await textractClient.send(command);
      if (response.Blocks) {
        allBlocks.push(...response.Blocks);
      }
      nextToken = response.NextToken;
    } while (nextToken);

    return allBlocks;
  }

  /**
   * Paginates through GetDocumentAnalysis results to extract and consolidate raw text from LINE blocks.
   * INVARIANT R2: Must paginate until NextToken is null.
   * INVARIANT R3: Derived exclusively from BlockType == LINE.
   */
  public static async getConsolidatedText(jobId: string): Promise<{ rawText: string; totalLines: number }> {
    let nextToken: string | undefined = undefined;
    const allLineTexts: string[] = [];

    do {
      const command: GetDocumentAnalysisCommand = new GetDocumentAnalysisCommand({
        JobId: jobId,
        NextToken: nextToken,
      });

      const response = await textractClient.send(command);
      const blocks: Block[] = response.Blocks || [];

      // Filter and push LINE texts
      for (const block of blocks) {
        if (block.BlockType === "LINE" && block.Text) {
          allLineTexts.push(block.Text);
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return {
      rawText: allLineTexts.join("\n"),
      totalLines: allLineTexts.length,
    };
  }
}


