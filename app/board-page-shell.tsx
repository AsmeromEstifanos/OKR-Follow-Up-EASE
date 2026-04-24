"use client";

import BoardViewClient from "@/app/board-view-client";
import DashboardVentureTabs from "@/app/dashboard-venture-tabs";
import useCurrentUserEmail from "@/app/use-current-user-email";
import type {
  BoardCardColors,
  CheckInFrequency,
  FieldOptions,
  Kpi,
  KeyResult,
  KrStatus,
  MetricType,
  Objective,
  ObjectiveStatus,
  ObjectiveType,
  OkrCycle,
  Venture,
} from "@/lib/types";
import { useState } from "react";

type BoardKpiData = {
  kpi: Kpi;
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type BoardKrData = {
  keyResult: KeyResult;
  kpis: BoardKpiData[];
  latestUpdateNotes?: string;
  latestUpdatedAt?: string | null;
};

type BoardObjectiveData = {
  objective: Objective;
  keyResults: BoardKrData[];
};

type BoardOwnerSection = {
  positionName: string;
  positionKey?: string;
  positionOwner?: string;
  positionOwnerEmail?: string;
  objectives: BoardObjectiveData[];
};

type Props = {
  showVentureTabs: boolean;
  ventures: Venture[];
  selectedVentureKey?: string;
  selectedVentureName?: string;
  ownerSections: BoardOwnerSection[];
  adminEmails: string[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultCycle: OkrCycle;
  fieldOptions: FieldOptions;
  boardCardColors: BoardCardColors;
};

export default function BoardPageShell({
  showVentureTabs,
  ventures,
  selectedVentureKey,
  selectedVentureName,
  ownerSections,
  adminEmails,
  defaultStartDate,
  defaultEndDate,
  defaultCycle,
  fieldOptions,
  boardCardColors,
}: Props): JSX.Element {
  const currentUserEmail = useCurrentUserEmail();
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [allSectionsOpen, setAllSectionsOpen] = useState(true);

  const toolbar = currentUserEmail ? (
    <div className="board-visibility-filters">
      <label className="ios-switch-field">
        <span className="ios-switch-label">Assigned To Me</span>
        <button
          type="button"
          role="switch"
          aria-checked={showAssignedOnly}
          className={`ios-switch ${showAssignedOnly ? "is-on" : ""}`}
          onClick={() => setShowAssignedOnly((current) => !current)}
        >
          <span className="ios-switch-track" aria-hidden="true">
            <span className="ios-switch-thumb" />
          </span>
        </button>
      </label>
      <button
        type="button"
        className="tab-btn"
        onClick={() => setAllSectionsOpen((current) => !current)}
      >
        {allSectionsOpen ? "Collapse All" : "Expand All"}
      </button>
    </div>
  ) : null;

  return (
    <>
      {showVentureTabs ? (
        <DashboardVentureTabs
          ventures={ventures}
          selectedVentureKey={selectedVentureKey}
          adminEmails={adminEmails}
          trailingContent={toolbar}
        />
      ) : null}
      <section className="section">
        <BoardViewClient
          selectedVentureKey={selectedVentureKey}
          selectedVentureName={selectedVentureName}
          ownerSections={ownerSections}
          adminEmails={adminEmails}
          defaultStartDate={defaultStartDate}
          defaultEndDate={defaultEndDate}
          defaultCycle={defaultCycle}
          fieldOptions={fieldOptions}
          boardCardColors={boardCardColors}
          currentUserEmail={currentUserEmail}
          showAssignedOnly={showAssignedOnly}
          allSectionsOpen={allSectionsOpen}
        />
      </section>
    </>
  );
}
