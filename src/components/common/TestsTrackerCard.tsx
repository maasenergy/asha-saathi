import React, { useState } from 'react';
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Syringe,
  FlaskConical,
  Scan,
  Activity,
  Plus,
  Edit3,
} from 'lucide-react';
import { AncTestItem, AncTestStatus } from '../../types';
import { useDemo } from '../../context/DemoContext';

interface TestsTrackerCardProps {
  patientId: string;
  patientName: string;
  tests: AncTestItem[];
  allowEdit?: boolean;
  simplifiedView?: boolean;
}

export const TestsTrackerCard: React.FC<TestsTrackerCardProps> = ({
  patientId,
  patientName,
  tests = [],
  allowEdit = true,
  simplifiedView = false,
}) => {
  const { language, updateTestStatus } = useDemo();
  const [filter, setFilter] = useState<'ALL' | 'DONE' | 'PENDING'>('ALL');
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [newResult, setNewResult] = useState('');

  const completedTests = tests.filter((t) => t.status === 'DONE');
  const pendingTests = tests.filter((t) => t.status === 'PENDING' || t.status === 'OVERDUE');
  const overdueCount = tests.filter((t) => t.status === 'OVERDUE').length;

  const total = tests.length || 1;
  const percentComplete = Math.round((completedTests.length / total) * 100);

  const displayedTests = tests.filter((t) => {
    if (filter === 'DONE') return t.status === 'DONE';
    if (filter === 'PENDING') return t.status === 'PENDING' || t.status === 'OVERDUE';
    return true;
  });

  const getCategoryIcon = (cat: AncTestItem['category']) => {
    switch (cat) {
      case 'LAB':
        return <FlaskConical className="w-3.5 h-3.5 text-blue-600" />;
      case 'VACCINE':
        return <Syringe className="w-3.5 h-3.5 text-purple-600" />;
      case 'SCAN':
        return <Scan className="w-3.5 h-3.5 text-indigo-600" />;
      case 'ROUTINE':
      default:
        return <Activity className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  const handleSaveResult = (testId: string) => {
    updateTestStatus(patientId, testId, 'DONE', newResult.trim() || 'Completed');
    setEditingTestId(null);
    setNewResult('');
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
      {/* Header & KPI Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-[#B0306A]" />
            <h3 className="font-bold font-heading text-base sm:text-lg text-[#1E2A4A]">
              {language === 'hi' ? 'प्रसव पूर्व आवश्यक जाँचें (ANC Tests Tracker)' : 'Antenatal Tests Tracker'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === 'hi'
              ? `${patientName} की कुल ${tests.length} आवश्यक जाँचों की स्थिति`
              : `Status of ${tests.length} essential antenatal tests for ${patientName}`}
          </p>
        </div>

        {/* Counts summary pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {completedTests.length} {language === 'hi' ? 'कराई गईं' : 'Done'}
            </span>
          </div>

          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
              overdueCount > 0
                ? 'bg-red-50 text-red-800 border-red-300 animate-pulse'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>
              {pendingTests.length} {language === 'hi' ? 'बाकी हैं' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-medium">
          <span>{language === 'hi' ? 'जाँच पूर्णता दर' : 'Tests Completion Rate'}</span>
          <span className="font-bold text-[#1E2A4A]">{percentComplete}% ({completedTests.length}/{total})</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#2F7D4F] h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${percentComplete}%` }}
          ></div>
        </div>
      </div>

      {/* Filter Tabs (unless simplifiedView) */}
      {!simplifiedView && (
        <div className="flex gap-1.5 border-b border-slate-100 pb-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              filter === 'ALL'
                ? 'bg-[#1E2A4A] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {language === 'hi' ? 'सभी जाँचें' : 'All'} ({tests.length})
          </button>
          <button
            onClick={() => setFilter('DONE')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              filter === 'DONE'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {language === 'hi' ? 'कराई गईं (Done)' : 'Completed'} ({completedTests.length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
              filter === 'PENDING'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {language === 'hi' ? 'बाकी जाँचें (Due)' : 'Pending'} ({pendingTests.length})
          </button>
        </div>
      )}

      {/* Tests List */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {displayedTests.map((test) => {
          const isDone = test.status === 'DONE';
          const isOverdue = test.status === 'OVERDUE';
          const isEditing = editingTestId === test.id;

          return (
            <div
              key={test.id}
              className={`p-3 rounded-xl border transition ${
                isOverdue
                  ? 'border-red-300 bg-red-50/50'
                  : isDone
                  ? 'border-slate-200 bg-white hover:border-slate-300'
                  : 'border-amber-200 bg-amber-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : isOverdue
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {getCategoryIcon(test.category)}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-[#1E2A4A]">
                        {language === 'hi' ? test.nameHindi : test.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        [{test.category}]
                      </span>
                    </div>

                    {/* Result or Due notice */}
                    {isDone ? (
                      <div className="text-xs text-slate-600 mt-0.5">
                        <span className="text-emerald-700 font-semibold">
                          {language === 'hi' ? 'परिणाम:' : 'Result:'}{' '}
                        </span>
                        <strong className="text-slate-800">{test.result || 'Done'}</strong>
                        {test.completedDate && (
                          <span className="text-[11px] text-slate-400 ml-1.5">
                            ({test.completedDate})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-amber-800 mt-0.5 font-medium">
                        <span>{language === 'hi' ? 'तिथि:' : 'Due:'} </span>
                        <strong>{test.dueDate || 'Pending'}</strong>
                      </div>
                    )}

                    {test.clinicalNote && (
                      <p className="text-[11px] text-slate-500 mt-1 italic">
                        {test.clinicalNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status pill & update action */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : isOverdue
                        ? 'bg-red-100 text-red-800 border border-red-300 font-extrabold animate-pulse'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isDone
                      ? (language === 'hi' ? 'पूर्ण (Done)' : 'Done')
                      : isOverdue
                      ? (language === 'hi' ? 'अति आवश्यक (Due)' : 'Overdue')
                      : (language === 'hi' ? 'बाकी (Pending)' : 'Pending')}
                  </span>

                  {allowEdit && !isDone && (
                    <button
                      onClick={() => setEditingTestId(isEditing ? null : test.id)}
                      className="text-[11px] font-bold text-[#B0306A] hover:underline flex items-center gap-1 mt-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{language === 'hi' ? 'जाँच दर्ज करें' : 'Record'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Record Result form */}
              {isEditing && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex gap-2">
                  <input
                    type="text"
                    value={newResult}
                    onChange={(e) => setNewResult(e.target.value)}
                    placeholder={
                      language === 'hi' ? 'जाँच का परिणाम लिखें...' : 'Enter test result...'
                    }
                    className="flex-1 p-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#B0306A]"
                  />
                  <button
                    onClick={() => handleSaveResult(test.id)}
                    className="px-3 py-1.5 bg-[#2F7D4F] hover:bg-[#25653f] text-white text-xs font-bold rounded-lg shadow"
                  >
                    {language === 'hi' ? 'सहेजें' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditingTestId(null)}
                    className="px-2 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg"
                  >
                    {language === 'hi' ? 'रद्द' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
