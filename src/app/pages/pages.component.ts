import {isPlatformBrowser} from "@angular/common";
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  OnChanges,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {ChildrenOutletContexts} from '@angular/router';
import {Subscription} from "rxjs";
import {slideInAnimation} from '../animations';
import {SUPER_ADMIN_MENU} from '../core/db/menu-data';
import {DATABASE_KEY} from "../core/utils/global-variable";
import {ShopInformation} from "../interfaces/common/shop-information.interface";
import {AdminMenu} from '../interfaces/core/admin-menu.interface';
import {AdminService} from '../services/common/admin.service';
import {SettingService} from "../services/common/setting.service";
import {ShopInformationService} from "../services/common/shop-information.service";
import {ReloadService} from "../services/core/reload.service";
import {ShopPackageService} from "../services/core/shop-package.service";
import {StorageService} from "../services/core/storage.service";
import {VendorService} from "../services/vendor/vendor.service";

@Component({
  selector: 'app-pages',
  templateUrl: './pages.component.html',
  styleUrl: './pages.component.scss',
  animations: [slideInAnimation]
})
export class PagesComponent implements OnInit, OnDestroy, OnChanges {
  // Store Data
  allMenus: AdminMenu[] = [];
  shopInfo: ShopInformation;
  currency: any;
  allShopID = ['67de7097554f668b2dc66444'];
  incompleteOrder: any;
  prescriptionOrder: any;
  affiliateSetting: any;
  blogSetting: any;
  productSetting: any;
  websiteInfo: any;
  selectedValue: string;
  sideNav = true;
  sideRes = false;
  subId = 0;
  subMenuId = 0; // For nested submenu
  step = 0;
  windowWidth: number;
  USER_ROLE: string | null = null;
  shopPackageInfo: any;

  @ViewChild('dashboard') dashboard: ElementRef;

  // DI
  private readonly platformId = inject(PLATFORM_ID);
  private readonly shopPackageService = inject(ShopPackageService);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private contexts: ChildrenOutletContexts,
    private adminService: AdminService,
    private shopInfoService: ShopInformationService,
    private vendorService: VendorService,
    private settingService: SettingService,
    private storageService: StorageService,
    private reloadService: ReloadService,
  ) {}

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // ---------- Lifecycle ----------
  ngOnInit(): void {
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      this.subId = JSON.parse(sessionStorage.getItem('sub-id') || '0');
    } else {
      this.windowWidth = 1200; // SSR fallback
      this.subId = 0;
    }

    // role read (guarded)
    this.USER_ROLE = (this.vendorService.getUserRole?.() as any) || null;
    this.rebuildMenus();

    // reactive refresh hooks
    this.subscriptions.push(
      this.reloadService.refreshIncompleteOrder$.subscribe(() => this.getSetting())
    );
    this.subscriptions.push(
      this.shopPackageService.shopPackageInfo$.subscribe(() => this.getShopInfo())
    );

    // initial data
    this.getSetting();
    this.getShopInfo();
  }

  ngOnChanges(_: SimpleChanges): void {
    // keep in sync with package info changes
    this.subscriptions.push(
      this.shopPackageService.shopPackageInfo$.subscribe(() => this.getShopInfo())
    );
    this.rebuildMenus();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s?.unsubscribe());
  }

  // ---------- Helpers (keys, filters) ----------
  private nameToKey(name: string): string {
    return (name || '')
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

  private normalizeRouteKey(route?: string): string {
    if (!route) return '';
    const first = route.split('/')[0] || '';
    return this.nameToKey(first);
  }

  // /** parent + child উভয় লেভেলে permission প্রয়োগ */
  // private filterMenusByPermissionsDeep(menus: AdminMenu[], allowed: Set<string>): AdminMenu[] {
  //   return (menus || []).map(m => ({ ...m })).filter(menu => {
  //     const parentKey = this.nameToKey(menu.name);
  //
  //     if (!allowed.has(parentKey)) return false;
  //
  //     if (menu.hasSubMenu && Array.isArray((menu as any).subMenus)) {
  //       const subMenus = (menu as any).subMenus.filter((sm: any) => {
  //         const childKeyByName = this.nameToKey(sm?.name);
  //         const childKeyByRoute = this.normalizeRouteKey(sm?.routerLink);
  //         return allowed.has(childKeyByName) || allowed.has(childKeyByRoute);
  //       });
  //       (menu as any).subMenus = subMenus;
  //     }
  //     return true;
  //   });
  // }

  /** parent + child উভয় লেভেলে permission প্রয়োগ
   *  Rule:
   *  - যদি parent key `allowed`-এ থাকে → parent রাখা হবে এবং তার সব subMenus অপরিবর্তিত থাকবে
   *  - যদি parent key না থাকে → শুধু `allowed`-এ থাকা child-গুলো রেখে parent দেখানো হবে
   *  - parent/child key মিলানোর সময় name ও routerLink—দুটোভাবেই মিলানো হয়
   */
  private filterMenusByPermissionsDeep(menus: AdminMenu[], allowed: Set<string>): AdminMenu[] {
    const isAllowedKey = (key?: string) =>
      !!key && allowed.has(key.trim().toLowerCase());

    const isMenuAllowed = (m: AdminMenu) => {
      const nameKey = this.nameToKey(m?.name);
      const routeKey = this.normalizeRouteKey(m?.routerLink);
      return isAllowedKey(nameKey) || isAllowedKey(routeKey);
    };

    const isSubAllowed = (sm: any) => {
      const childKeyByName = this.nameToKey(sm?.name);
      const childKeyByRoute = this.normalizeRouteKey(sm?.routerLink);
      return isAllowedKey(childKeyByName) || isAllowedKey(childKeyByRoute);
    };

    return (menus || [])
      .map(m => ({ ...m, subMenus: Array.isArray((m as any).subMenus) ? [...(m as any).subMenus] : [] }))
      .flatMap(menu => {
        const parentAllowed = isMenuAllowed(menu);

        // No sub menu: keep only if parent is allowed
        if (!menu.hasSubMenu || !Array.isArray((menu as any).subMenus) || !(menu as any).subMenus.length) {
          return parentAllowed ? [menu] : [];
        }

        // Has sub menus
        if (parentAllowed) {
          // ✅ parent allowed → keep ALL children unchanged
          return [menu];
        } else {
          // ❗ parent not allowed → keep only allowed children
          const filteredChildren = (menu as any).subMenus.filter(isSubAllowed);
          if (filteredChildren.length) {
            return [{ ...menu, subMenus: filteredChildren }];
          }
          return [];
        }
      });
  }


  /** role অনুযায়ী base menu */
  private buildBaseMenus(role: string | null): AdminMenu[] {
    switch ((role || '').toLowerCase()) {
      case 'owner':   return SUPER_ADMIN_MENU.slice();
      case 'admin':   return SUPER_ADMIN_MENU.slice();
      case 'manager': return SUPER_ADMIN_MENU.slice();
      case 'editor':  return SUPER_ADMIN_MENU.slice();
      default:        return [];
    }
  }

  /** Dynamic menu modifiers base-এর পরে */
  private applyDynamicMenus(base: AdminMenu[]): AdminMenu[] {
    let menus = base.slice();

    // Incomplete Orders -> Orders menu replace
    if (this.incompleteOrder) {
      menus = this.applyIncompleteOrderMenu(menus, !!this.incompleteOrder?.isEnableIncompleteOrder);
    }
    // if (this.prescriptionOrder) {
    //   menus = this.applyIncompleteOrderMenu(menus, !!this.prescriptionOrder?.isEnablePrescriptionOrder);
    // }

    // Blog
    if (this.blogSetting) {
      menus = this.applyBlogMenu(menus, !!this.blogSetting?.isEnableBlog);
    }

    // Campaign
    if (this.productSetting) {
      // menus = this.applyCampaignMenu(menus, !!this.productSetting?.isCampaignEnable);
      menus = this.applyPCBuilderMenu(menus, !!this.productSetting?.isEnablePCBuilder);
      // menus = this.applyServiceMenu(menus, !!this.productSetting?.isEnableService);
    }

    // Catalog conditional submenus
    menus = this.applyCatalogMenu(menus);

    return menus;
  }

  private applyIncompleteOrderMenu(menus: AdminMenu[], enable: boolean): AdminMenu[] {
    const idx = menus.findIndex((m: any) => m.name === 'Orders');
    if (idx === -1) return menus;


    // console.log('enable',enable)
    const subMenus = [
      { id: 1, name: 'Orders', hasSubMenu: true, routerLink: 'order/all-order', icon: 'arrow_right' },
      { id: 2, name: 'Incomplete Orders', hasSubMenu: true, routerLink: 'order/all-incomplete-order', icon: 'arrow_right' },
    ];

    // Add prescription orders if enabled
    if (this.prescriptionOrder) {
      subMenus.push({ id: 3, name: 'Prescription orders', hasSubMenu: true, routerLink: 'order/all-prescription-order', icon: 'arrow_right' });
    }

    const updated = enable
      ? {
        id: 1,
        name: 'Orders',
        hasSubMenu: true,
        routerLink: null,
        icon: 'reorder',
        subMenus: subMenus,
      }
      : {
        id: 1,
        name: 'Orders',
        hasSubMenu: false,
        routerLink: 'order/all-order',
        icon: 'reorder',
        subMenus: [],
      };

    // console.log("updated",updated)
    const cloned = menus.slice();
    // console.log('---cloned',cloned)
    cloned[idx] = updated as any;
    // console.log('cloned---',cloned)
    return cloned;
  }

  private applyBlogMenu(menus: AdminMenu[], enable: boolean): AdminMenu[] {
    const cloned = menus.slice();
    const has = cloned.some(m => (m as any).id === 666);
    if (enable) {
      if (!has) {
        const blogMenu: any = {
          id: 666,
          name: 'Blogs',
          hasSubMenu: true,
          routerLink: null,
          icon: 'reorder',
          subMenus: [
            { id: 1, name: 'All Blogs', hasSubMenu: false, routerLink: 'blog/all-blog', icon: 'arrow_right' },
            { id: 2, name: 'Blog Comments', hasSubMenu: false, routerLink: 'blog-comment/all-blog-comments', icon: 'arrow_right' }
          ],
        };
        cloned.splice(Math.min(12, cloned.length), 0, blogMenu);
      }
    } else {
      return cloned.filter(m => (m as any).id !== 666);
    }
    return cloned;
  }

  private applyCampaignMenu(menus: AdminMenu[], enable: boolean): AdminMenu[] {
    const cloned = menus.slice();
    const has = cloned.some(m => (m as any).id === 667);
    if (enable) {
      if (!has) {
        const campaign: any = {
          id: 667,
          name: 'Campaign',
          hasSubMenu: true,
          routerLink: null,
          icon: 'campaign',
          subMenus: [
            { id: 1, name: 'All Campaigns', hasSubMenu: false, routerLink: 'campaign/all-campaign', icon: 'arrow_right' },
          ],
        };
        cloned.splice(Math.min(3, cloned.length), 0, campaign);
      }
    } else {
      return cloned.filter(m => (m as any).id !== 667);
    }
    return cloned;
  }
  private applyPCBuilderMenu(menus: AdminMenu[], enable: boolean): AdminMenu[] {
    const cloned = menus.slice();
    const has = cloned.some(m => (m as any).id === 668);
    if (enable) {
      if (!has) {
        const pcBuilder: any = {
          id: 668,
          name: 'Pc Builder',
          hasSubMenu: true,
          routerLink: null,
          icon: 'category',
          subMenus: [
            { id: 1, name: 'All Pc Builder', hasSubMenu: false, routerLink: 'pc-builder/all-pc-builder', icon: 'arrow_right' },
          ],
        };
        cloned.splice(Math.min(4, cloned.length), 0, pcBuilder);
      }
    } else {
      return cloned.filter(m => (m as any).id !== 668);
    }
    return cloned;
  }

  private applyCatalogMenu(menus: AdminMenu[]): AdminMenu[] {
    const shopID = this.vendorService.getShopId?.();
    const isSpecialShop = shopID && this.allShopID.includes(shopID);

    const idx = menus.findIndex((m: any) => m.name === 'Catalog');
    if (idx === -1) return menus;

    const baseSubs: any[] = [
      { id: 1, name: 'Categories', hasSubMenu: true, routerLink: 'catalog/all-category', icon: 'arrow_right' },
      { id: 2, name: 'Sub Categories', hasSubMenu: true, routerLink: 'catalog/all-sub-category', icon: 'arrow_right' },
      { id: 3, name: 'Child Categories', hasSubMenu: true, routerLink: 'catalog/all-child-category', icon: 'arrow_right' },
      { id: 4, name: 'Brand', hasSubMenu: true, routerLink: 'catalog/all-brand', icon: 'arrow_right' },
      { id: 6, name: 'Tags', hasSubMenu: true, routerLink: 'catalog/all-tag', icon: 'arrow_right' },
    ];

    if (isSpecialShop) {
      baseSubs.push(
        { id: 7, name: 'Skin Type', hasSubMenu: true, routerLink: 'catalog/all-skin-type', icon: 'arrow_right' },
        { id: 8, name: 'Skin Concern', hasSubMenu: true, routerLink: 'catalog/all-skin-concern', icon: 'arrow_right' },
      );
    }

    const updated: any = {
      id: 5,
      name: 'Catalog',
      hasSubMenu: true,
      routerLink: null,
      icon: 'category',
      subMenus: baseSubs,
    };

    const cloned = menus.slice();
    cloned[idx] = updated;
    return cloned;
  }

  private applyServiceMenu(menus: AdminMenu[], enable: boolean): AdminMenu[] {
    const cloned = menus.slice();
    const has = cloned.some(m => (m as any).id === 5377);
    if (enable) {
      if (!has) {
        const pcBuilder: any = {
          id: 5377,
          name: 'Service',
          hasSubMenu: true,
          routerLink: null,
          icon: 'web',
          subMenus: [
            {
              id: 1,
              name: 'Service',
              hasSubMenu: true,
              routerLink: 'service/all-service',
              icon: 'arrow_right',
            },
            {
              id: 2,
              name: 'Booking',
              hasSubMenu: true,
              routerLink: 'booking/all-booking',
              icon: 'arrow_right',
            },
          ],
        };
        cloned.splice(Math.min(5, cloned.length), 0, pcBuilder);
      }
    } else {
      return cloned.filter(m => (m as any).id !== 5377);
    }
    return cloned;
  }

  /** master rebuild: role ⇒ base ⇒ dynamic ⇒ permission (when ready) */
  private rebuildMenus(): void {
    const roleRaw = (this.vendorService.getUserRole?.() as any) || this.USER_ROLE || '';
    const role = (roleRaw || '').toLowerCase();

    if (!role) return; // wait until role is available
    this.USER_ROLE = role;

    // 1) base
    let menus = this.buildBaseMenus(role);

    // 2) dynamic apply (safe even if settings undefined)
    menus =  this.applyDynamicMenus(menus);

    // 3) permission apply when ready (non-owner)
    if (role !== 'owner') {
      const allowedArr = (this.vendorService.getUserPagePermissions?.() as string[]) || [];

      // console.log("allowedArr", allowedArr);

      if (Array.isArray(allowedArr) && allowedArr.length > 0) {
        const allowed = new Set(allowedArr.map(k => (k || '').toLowerCase()));
        menus = this.filterMenusByPermissionsDeep(menus, allowed);
      }
      // else: permissions not ready/empty → temporarily show base menus
    }


    this.allMenus = menus;
  }

  // ---------- UI handlers ----------
  onMenuToggle(_: boolean) {
    this.sideNav = !this.sideNav;
    this.sideRes = !this.sideNav;
  }

  sideNavToggle() {
    this.sideNav = !this.sideNav;
    this.sideRes = !this.sideNav;
  }

  subMenuToggle(num: number, _subMenu?: boolean, parentId?: number) {
    // If parentId is provided, it's a nested submenu toggle
    if (parentId !== undefined) {
      if (this.subMenuId && this.subMenuId === num) {
        this.subMenuId = 0;
      } else {
        this.subMenuId = num;
      }
      return;
    }

    // Original logic for main menu toggle
    if (this.isBrowser) {
      this.windowWidth = window.innerWidth;
      sessionStorage.setItem('sub-id', String(num));
    }
    if (this.subId && this.subId === num) {
      this.subId = 0;
      this.dashboard?.nativeElement?.classList.add('link-active');
    } else {
      this.subId = this.isBrowser ? JSON.parse(sessionStorage.getItem('sub-id') || '0') : 0;
      this.dashboard?.nativeElement?.classList.remove('link-active');
    }
    if (num === 0) {
      this.dashboard?.nativeElement?.classList.add('link-active');
    }
  }

  @HostListener('window:resize')
  onInnerWidthChange() {
    if (!this.isBrowser) return;
    this.windowWidth = window.innerWidth;
  }

  /** listen storage only on browser */
  @HostListener('window:storage', ['$event'])
  onStorageChange(e: StorageEvent) {
    if (!this.isBrowser || !e) return;
    if (e.key === 'vendor-data' || e.key === 'user-permissions' || e.key === 'sub-id') {
      this.rebuildMenus();
    }
  }

  adminLogOut() {
    this.vendorService.userLogOut?.(true);
  }

  upgradeAdmin() {
    if (!this.isBrowser) return;
    const phoneNumber = '8801648879969';
    const message = `Hello, I need help with upgrade my admin panel.\nPlease help me upgrade my admin panel to continue using the services.`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  // ---------- HTTP / Data loads ----------
  private getShopInfo() {
    const subscription = this.shopInfoService.getShopInformation().subscribe({
      next: res => {
        this.shopInfo = res.data;
        this.websiteInfo = res.fShopDomain;

        // ✅ LocalStorage এ সেভ করো
        if (res.fShopDomain.theme) {
          localStorage.setItem('themeInfo', JSON.stringify(res.fShopDomain.theme));
        }



        // starter টাইপ হলে কিছু মেনু remove
        if (this.websiteInfo?.shopType === 'starter') {
          const dynamicMenus = ['Customization','Landing page','Coupon','Seo Pages','Admin Control','New Release'];
          this.allMenus = (this.allMenus || []).filter(item => !dynamicMenus.includes(item.name));
        }

        this.shopPackageInfo = {
          currentBalance: res.currentBalance ?? 0,
          expireDay: res.expireDay ?? 0,
          isTrailPrice: res.fShopDomain?.isTrailPrice ?? false,
          trialPeriod: res.fShopDomain?.trialPeriod ?? 0,
          shopType: res.shopType ?? 'free',
        };

        this.setFavicon(this.shopInfo?.fabIcon);

        // reflect dynamic/permission after info
        this.rebuildMenus();
      },
      error: err => console.error(err)
    });
    this.subscriptions.push(subscription);
  }

  private getSetting() {
    const subscription = this.settingService.getSetting('currency productSetting incompleteOrder orderSetting affiliate blog')
      .subscribe({
        next: res => {
          if (!res?.data) return;
          this.currency = res.data.currency;
          this.incompleteOrder = res.data.incompleteOrder;
          this.prescriptionOrder = res.data.orderSetting?.isEnablePrescriptionOrder;
          this.affiliateSetting = res.data.affiliate;
          this.blogSetting = res.data.blog;
          this.productSetting = res.data.productSetting;

          // console.log('res.data.orderSetting',res.data.orderSetting)

          if (this.currency) this.currencySymbolSaveLocalStorage();

          // re-apply dynamic + permission
          this.rebuildMenus();
        },
        error: err => console.log(err)
      });

    this.subscriptions.push(subscription);
  }

  private currencySymbolSaveLocalStorage() {
    const old = this.storageService.getDataFromLocalStorage(DATABASE_KEY.currency);
    if (old?.code !== this.currency?.code) {
      this.storageService.storeDataToLocalStorage(this.currency, DATABASE_KEY.currency);
    }
  }

  // ---------- Misc ----------
  setFavicon(iconPath: string) {
    if (this.isBrowser && iconPath) {
      const link: HTMLLinkElement = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = iconPath;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'];
  }
}
