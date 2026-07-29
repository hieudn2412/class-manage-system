import { Check } from "lucide-react";

const steps = [
  ["Thông tin lớp", "Dữ liệu nền và giáo viên"],
  ["Học sinh", "Chọn tài khoản có sẵn"],
  ["Lịch & phòng", "Thiết lập nhiều ca mỗi tuần"],
  ["Xem trước", "Kiểm tra và công bố"],
] as const;

interface ClassWizardStepperProps {
  currentStep: number;
  onStepChange: (step: number) => void;
}

export const ClassWizardStepper = ({ currentStep, onStepChange }: ClassWizardStepperProps) => (
  <nav className="wizard-stepper" aria-label="Các bước tạo lớp">
    <ol>
      {steps.map(([label, description], index) => {
        const step = index + 1;
        const complete = step < currentStep;
        return (
          <li className={step === currentStep ? "active" : ""} key={label}>
            <button
              type="button"
              onClick={() => onStepChange(step)}
              aria-current={step === currentStep ? "step" : undefined}
            >
              <span className="wizard-step-number" aria-hidden="true">
                {complete ? <Check size={16} /> : step}
              </span>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
