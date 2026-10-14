import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Step1Setup from "../components/Step1Setup";
import Step2Interview from "../components/Step2Interview";
import Step3Report from "../components/Step3Report";

const InterviewPage = () => {
  const { userData } = useSelector((state) => state.user);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [interviewData, setInterviewData] = useState(null);
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    if (!userData) {
      navigate("/auth");
    }
  }, [userData, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {step === 1 && (
        <Step1Setup
          onStart={(data) => {
            setInterviewData(data);
            setStep(2);
          }}
        />
      )}
      {step == 2 && interviewData && (
        <Step2Interview
          interviewData={interviewData}
          onFinish={(report) => {
            setReportData(report);
            setStep(3);
          }}
        />
      )}
      {step == 3 && <Step3Report report={reportData} />}
    </div>
  );
};

export default InterviewPage;
