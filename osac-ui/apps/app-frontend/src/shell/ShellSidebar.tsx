import * as React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Content,
  ContentVariants,
  Divider,
  Nav,
  NavExpandable,
  NavItem,
  NavList,
  PageSidebar,
  PageSidebarBody,
} from '@patternfly/react-core';

import {
  isNavLink as isNavLinkExtension,
  isNavSection as isNavSectionExtension,
  navigationRoleAllowed,
  useExtensions,
} from '@osac/extensions';
import { useSession } from '@osac/ui-components/hooks/use-session';
import { useTranslation } from '@osac/ui-components/hooks/useTranslation';

import { type NavLink, type NavSection, isNavSection, navRowsForRole } from './shellNav';

import './ShellSidebar.css';

const ShellNavItem = ({ item }: { item: NavLink }) => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <NavItem
      itemId={item.id}
      isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
      to={item.path}
      onClick={(e) => {
        e.preventDefault();
        navigate(item.path);
      }}
    >
      {item.label}
    </NavItem>
  );
};

export const ShellSidebar = () => {
  const { role, enabledServices } = useSession();
  const { t } = useTranslation();
  const [navSectionExtensions] = useExtensions(isNavSectionExtension);
  const [navLinkExtensions] = useExtensions(isNavLinkExtension);

  const navRows = React.useMemo(() => {
    const rows = navRowsForRole(role, t, enabledServices);
    const pluginSections = new Map<string, NavSection>();

    navSectionExtensions.forEach((extension) => {
      pluginSections.set(extension.properties.id, {
        kind: 'section',
        id: extension.properties.id,
        label: extension.properties.label,
        children: [],
      });
    });

    rows.push(...pluginSections.values());

    navLinkExtensions.forEach((extension) => {
      if (!navigationRoleAllowed(extension.properties.allowedRoles, role)) {
        return;
      }

      const link: NavLink = {
        kind: 'link',
        id: extension.id,
        label: extension.properties.label,
        path: extension.properties.path,
      };
      const section =
        extension.properties.section === undefined
          ? undefined
          : (pluginSections.get(extension.properties.section) ??
            rows.find(
              (row): row is NavSection =>
                isNavSection(row) && row.id === extension.properties.section,
            ));

      if (section) {
        section.children.push(link);
      } else {
        rows.push(link);
      }
    });

    return rows.filter((row) => !isNavSection(row) || row.children.length > 0);
  }, [role, t, enabledServices, navSectionExtensions, navLinkExtensions]);

  return (
    <PageSidebar>
      <PageSidebarBody usePageInsets isFilled>
        <Content className="osac-navbar-title" component={ContentVariants.h2}>
          {t('Cloud Extensions')}
        </Content>
        <Divider />
        <Nav aria-label="Primary navigation">
          <NavList>
            {navRows.map((row) => {
              if (isNavSection(row)) {
                return (
                  <NavExpandable key={row.id} title={row.label} isExpanded>
                    {row.children.map((item) => (
                      <ShellNavItem key={item.id} item={item} />
                    ))}
                  </NavExpandable>
                );
              }
              return <ShellNavItem key={row.id} item={row} />;
            })}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );
};
