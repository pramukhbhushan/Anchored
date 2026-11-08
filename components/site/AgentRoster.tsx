import styles from "@/components/site/landing.module.css";
import { CORE_AGENTS, SKILLS, spawnNicheAgents } from "@/lib/domain/agents";
import { SIGNALS } from "@/lib/domain/workflows";
import type { SkillId } from "@/lib/domain/types";

// =============================================================================
// Module Overview
// =============================================================================
// The landing page's third step: the five core agents with the skills each
// one runs, then every niche agent onboarding can spawn, in a dashed slot
// that names the answer that spawns it.

// Every niche agent any onboarding answer can spawn.
const NICHE = spawnNicheAgents(SIGNALS.map((signal) => signal.id));

/** Render the core agents as a roster and the niche agents below it. */
export function AgentRoster() {
  return (
    <div>
      <ul className={`${styles.sheet} ${styles.roster}`} aria-label="The five core agents">
        {Object.values(CORE_AGENTS).map((agent) => (
          <li className={styles.agent} key={agent.id}>
            <div>
              <h3 className={styles.agentName}>
                {agent.name}
                {agent.alwaysOn && <span className="badge">Always on</span>}
              </h3>
              <p className={styles.agentJob}>{agent.job}</p>
            </div>
            <SkillList skills={agent.skills} label={`${agent.name} skills`} />
          </li>
        ))}
      </ul>
      {NICHE.map((agent) => (
        <div className={styles.niche} key={agent.id}>
          <div className={styles.agent}>
            <div>
              <h3 className={styles.agentName}>{agent.name}</h3>
              <p className={styles.agentJob}>{agent.job}</p>
              <p className={styles.spawned}>
                <b>Spawned when you say:</b> {agent.spawnedBecause}
              </p>
            </div>
            <SkillList skills={agent.skills} label={`${agent.name} skills`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Render an agent's skills as small labels. */
function SkillList({ skills, label }: { readonly skills: readonly SkillId[]; readonly label: string }) {
  return (
    <ul className={styles.skills} aria-label={label}>
      {skills.map((id) => (
        <li key={id}>{SKILLS[id].name}</li>
      ))}
    </ul>
  );
}
