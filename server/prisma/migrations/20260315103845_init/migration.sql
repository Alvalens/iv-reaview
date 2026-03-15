-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobDescription" TEXT NOT NULL,
    "cvContent" TEXT,
    "interviewType" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "personaConfig" TEXT NOT NULL,
    "voiceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 600,
    "transcript" TEXT,
    "overallScore" DOUBLE PRECISION,
    "contentScore" DOUBLE PRECISION,
    "deliveryScore" DOUBLE PRECISION,
    "nonVerbalScore" DOUBLE PRECISION,
    "narrative" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewQuestion" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "contentScore" DOUBLE PRECISION,
    "deliveryScore" DOUBLE PRECISION,
    "nonVerbalScore" DOUBLE PRECISION,
    "feedback" TEXT,
    "deliveryFeedback" TEXT,
    "nonVerbalFeedback" TEXT,
    "speechMetrics" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterviewQuestion_interviewSessionId_questionIndex_key" ON "InterviewQuestion"("interviewSessionId", "questionIndex");

-- AddForeignKey
ALTER TABLE "InterviewQuestion" ADD CONSTRAINT "InterviewQuestion_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
