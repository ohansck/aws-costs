import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { CostReport } from "./types";

const s3 = new S3Client({});

function generateS3Key(report: CostReport): string {
  const date = new Date(report.startDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  let filename: string;
  switch (report.period) {
    case "day":
      filename = `daily-${report.startDate}.json`;
      break;
    case "week":
      filename = `weekly-${report.startDate}-to-${report.endDate}.json`;
      break;
    case "month":
      filename = `monthly-${report.startDate}-to-${report.endDate}.json`;
      break;
  }

  return `${year}/${month}/${day}/${filename}`;
}

export async function saveCostReportToS3(report: CostReport): Promise<string> {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    throw new Error("S3_BUCKET_NAME environment variable is not set");
  }

  const key = generateS3Key(report);

  console.log(`Saving report to S3: s3://${bucket}/${key}`);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(report, null, 2),
      ContentType: "application/json",
      Metadata: {
        period: report.period,
        startDate: report.startDate,
        endDate: report.endDate,
        totalUsageCost: report.totalUsageCost.amount,
        totalCreditsApplied: report.totalCreditsApplied.amount,
        totalCost: report.totalCost.amount,
      },
    })
  );

  return `s3://${bucket}/${key}`;
}
