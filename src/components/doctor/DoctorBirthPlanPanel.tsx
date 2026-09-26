import React, { useState } from 'react';
import { Building2, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { MotherProfile } from '../../types';
import { useDemo } from '../../context/DemoContext';
import { collectBirthPlanSafetyFactors, DeliveryPlace } from '../../rules/clinicalRules';
import { AiOfflineBanner } from '../common/AiOfflineBanner';

const FACILITIES: DeliveryPlace[] = [
  'PHC',
  'CHC/FRU with C-section',
  'District hospital / medical college',
];

interface DoctorBirthPlanPanelProps {
  patient: MotherProfile;
  doctorName?: string;
}

/**
 * Doctor review of the birth plan: approve the designated facility as-is, or change it.
 * Approval is shown to the ASHA (Alerts tab) and to the mother (birth plan tile).
 */
export const DoctorBirthPlanPanel: React.FC<DoctorBirthPlanPanelProps> = ({
  patient,
  doctorName = 'Dr. Anand Verma (MO, PHC)',
}) => {
  const { approveBirthPlan, refreshBirthPlan } = useDemo();
  const plan = patient.birthPlan;
  const [isChanging, setIsChanging] = useState(false);
  const [chosenFacility, setChosenFacility] = useState<DeliveryPlace>(plan?.deliveryPlace || 'CHC/FRU with C-section');
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const safetyReasons = collectBirthPlanSafetyFactors(patient).reasons;
  const overridesSafetyRule = chosenFacility === 'PHC' && safetyReasons.length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    await refreshBirthPlan(patient.id);
    setIsGenerating(false);
  };

  return (
    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#B0306A]" />
          <h4 className="font-bold text-sm text-[#1E2A4A]">Birth Plan Review</h4>
        </div>
        {plan?.doctorApproved && (
          <span className="text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Approved {plan.doctorApprovedAt ? new Date(plan.doctorApprovedAt).toLocaleString() : ''}
          </span>
        )}
      </div>

      {!plan ? (
        <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
          <span>No birth plan generated yet for this mother.</span>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-3 py-1.5 bg-[#1E2A4A] text-white rounded-lg font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            Generate
          </button>
        </div>
      ) : (
        <>
          {plan.isRuleEngineOnly && <AiOfflineBanner language="en" />}

          <div className="text-xs space-y-1.5">
            <div>
              <span className="text-slate-500 font-semibold">Designated facility: </span>
              <strong className="text-[#1E2A4A]">{plan.deliveryPlace}</strong>
              {plan.upgradedBySafetyRule && (
                <span className="ml-2 text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                  Upgraded by safety rule (AI suggested {plan.originalAiDeliveryPlace})
                </span>
              )}
            </div>
            {plan.deliveryPlaceReason.length > 0 && (
              <ul className="list-disc pl-4 text-slate-700 space-y-0.5">
                {plan.deliveryPlaceReason.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <div className="text-slate-700">
              <span className="text-slate-500 font-semibold">Leave home: </span>
              {plan.leaveHomeBy}
            </div>
            {plan.riskTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {plan.riskTags.map((tag) => (
                  <span key={tag} className="text-[10px] font-bold bg-rose-50 text-[#B0306A] px-1.5 py-0.5 rounded border border-rose-200">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {plan.doctorSummary && (
              <p className="text-slate-600 italic">
                AI draft: "{plan.doctorSummary}"
              </p>
            )}
            {plan.doctorApproved && plan.doctorNotes && (
              <p className="text-emerald-900 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                {plan.doctorNotes}
              </p>
            )}
          </div>

          {isChanging && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <label className="font-semibold text-slate-700 block">
                Delivery facility
                <select
                  value={chosenFacility}
                  onChange={(e) => setChosenFacility(e.target.value as DeliveryPlace)}
                  className="mt-1 w-full p-2 bg-white rounded-lg border border-slate-300"
                >
                  {FACILITIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              {overridesSafetyRule && (
                <div className="flex items-start gap-1.5 text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Safety rules recommend a C-section facility: {safetyReasons.join('; ')}. Record your reason below.
                  </span>
                </div>
              )}
              <label className="font-semibold text-slate-700 block">
                Notes for ASHA &amp; mother
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full p-2 bg-white rounded-lg border border-slate-300"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!isChanging ? (
              <>
                <button
                  type="button"
                  onClick={() => approveBirthPlan(patient.id, doctorName)}
                  className="px-3 py-2 bg-[#2F7D4F] hover:bg-[#25653f] text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {plan.doctorApproved ? 'Re-approve' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChosenFacility(plan.deliveryPlace);
                    setIsChanging(true);
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-[#1E2A4A] rounded-lg text-xs font-bold border border-slate-300"
                >
                  Change facility
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={overridesSafetyRule && !notes.trim()}
                  onClick={() => {
                    approveBirthPlan(patient.id, doctorName, chosenFacility, notes.trim() || undefined);
                    setIsChanging(false);
                    setNotes('');
                  }}
                  className="px-3 py-2 bg-[#2F7D4F] hover:bg-[#25653f] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  Approve with {chosenFacility}
                </button>
                <button
                  type="button"
                  onClick={() => setIsChanging(false)}
                  className="px-3 py-2 bg-white text-slate-700 rounded-lg text-xs font-bold border border-slate-300"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
