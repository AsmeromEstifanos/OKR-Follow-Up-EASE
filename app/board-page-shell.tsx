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
import { useEffect, useState } from "react";

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
  selectedVentureOwner?: string;
  selectedVentureOwnerEmail?: string;
  ownerSections: BoardOwnerSection[];
  adminEmails: string[];
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultCycle: OkrCycle;
  fieldOptions: FieldOptions;
  boardCardColors: BoardCardColors;
};

const ASSIGNED_ONLY_STORAGE_KEY = "ease-okr-board-assigned-only";

function ExpandAllIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2.5,4.5 7.5,9.5 12.5,4.5" />
      <polyline points="2.5,8.5 7.5,13.5 12.5,8.5" />
    </svg>
  );
}

function CollapseAllIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2.5,10.5 7.5,5.5 12.5,10.5" />
      <polyline points="2.5,6.5 7.5,1.5 12.5,6.5" />
    </svg>
  );
}

export default function BoardPageShell({
  showVentureTabs,
  ventures,
  selectedVentureKey,
  selectedVentureName,
  selectedVentureOwner,
  selectedVentureOwnerEmail,
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
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const saved = window.localStorage.getItem(ASSIGNED_ONLY_STORAGE_KEY);
    setShowAssignedOnly(saved === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      ASSIGNED_ONLY_STORAGE_KEY,
      showAssignedOnly ? "true" : "false",
    );
  }, [showAssignedOnly]);

  const toolbar = (
    <div className="board-visibility-filters">
      <div className="board-search-wrap">
        <input
          type="search"
          className="board-search-input board-search-input-toolbar"
          placeholder="Search objectives, KRs, owners…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search OKRs"
        />
      </div>
      {currentUserEmail ? (
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
      ) : null}
      <button
        type="button"
        className="tab-btn tab-btn-icon"
        title={allSectionsOpen ? "Collapse All" : "Expand All"}
        aria-label={allSectionsOpen ? "Collapse All" : "Expand All"}
        onClick={() => setAllSectionsOpen((current) => !current)}
      >
        {allSectionsOpen ? <CollapseAllIcon /> : <ExpandAllIcon />}
      </button>
    </div>
  );

  return (
    <>
      {showVentureTabs ? (
        <DashboardVentureTabs
          ventures={ventures}
          selectedVentureKey={selectedVentureKey}
          adminEmails={adminEmails}
          trailingContent={toolbar}
        />
      ) : (
        <div className="board-standalone-toolbar">{toolbar}</div>
      )}
      <section className="section">
        <BoardViewClient
          selectedVentureKey={selectedVentureKey}
          selectedVentureName={selectedVentureName}
          selectedVentureOwner={selectedVentureOwner}
          selectedVentureOwnerEmail={selectedVentureOwnerEmail}
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
          searchQuery={searchQuery}
        />
      </section>
    </>
  );
}
