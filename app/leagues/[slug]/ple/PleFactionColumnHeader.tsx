import styles from "./wrestlemania/PleWrestlemania.module.css";

type Props = {
  factionName: string;
  wrestlerNames: string[];
  /** When false, hide the roster list (e.g. draft not complete). */
  showRoster?: boolean;
};

export function PleFactionColumnHeader({
  factionName,
  wrestlerNames,
  showRoster = true,
}: Props) {
  return (
    <div className={styles.pleFactionHeader}>
      <div className={styles.pleFactionName}>{factionName}</div>
      {showRoster ? (
        wrestlerNames.length > 0 ? (
          <ul className={styles.pleFactionRosterList} aria-label={`${factionName} wrestlers on this card`}>
            {wrestlerNames.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <div className={styles.pleFactionRosterEmpty}>—</div>
        )
      ) : null}
    </div>
  );
}
