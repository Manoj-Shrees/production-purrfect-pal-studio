import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetailspageComponent } from './detailspage.component';
import { ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { Renderer2, NgZone, ChangeDetectorRef, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { DatePipe } from '@angular/common';
import { of } from 'rxjs';
import { DetailpageService } from '../Service/detail-page/detailpage.service';
import { SocketService } from '../Service/socket/socket.service';
import { UsersService } from '../Service/User/users.service';
import { ProductService } from '../Service/ProductPage/product.service';
import { ItemService } from '../Service/Items/item.service';
import { OrderCompleteService } from '../Service/Order/order-complete.service';
import { AuthService } from '../Service/Auth/auth.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { DownloaderService } from '../Service/FiledDownload/downloader.service';
import { FormsModule } from '@angular/forms';
import LZString from 'lz-string';

describe('DetailspageComponent', () => {
  let component: DetailspageComponent;
  let fixture: ComponentFixture<DetailspageComponent>;

  // Mocks
  let mockActivatedRoute: any;
  let mockDetailpageService: jasmine.SpyObj<DetailpageService>;
  let mockSocketService: jasmine.SpyObj<SocketService>;
  let mockUsersService: jasmine.SpyObj<UsersService>;
  let mockProductService: jasmine.SpyObj<ProductService>;
  let mockItemService: jasmine.SpyObj<ItemService>;
  let mockOrderCompleteService: jasmine.SpyObj<OrderCompleteService>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockLoggingService: jasmine.SpyObj<LoggingService>;
  let mockDownloaderService: jasmine.SpyObj<DownloaderService>;

  const mockOrderData = {
    Order_ID: 'TEST-123',
    Status: 'active',
    items: [
      { name: 'Item 1', price: 100 },
      { name: 'Item 2', price: 200 }
    ],
    item_urls: null,
    start_date: '2026-03-31T10:00:00Z'
  };

  const encodedOrder = LZString.compressToEncodedURIComponent(JSON.stringify(mockOrderData));

  beforeEach(async () => {
    mockActivatedRoute = {
      queryParams: of({ order: encodedOrder })
    };

    mockDetailpageService = jasmine.createSpyObj('DetailpageService', ['getorderdata']);
    mockSocketService = jasmine.createSpyObj('SocketService', ['connect', 'joinOrder', 'disconnect', 'onPreviousMessages', 'onNewMessage', 'onTyping', 'onStopTyping']);
    mockUsersService = jasmine.createSpyObj('UsersService', ['getuserprofilebyidnumber']);
    mockProductService = jasmine.createSpyObj('ProductService', ['uploadfiles', 'getfilebaseurl']);
    mockItemService = jasmine.createSpyObj('ItemService', ['uploadandcreate', 'getitemdata']);
    mockOrderCompleteService = jasmine.createSpyObj('OrderCompleteService', ['completeorder']);
    mockAuthService = jasmine.createSpyObj('AuthService', ['checkAuth', 'setUser']);
    mockLoggingService = jasmine.createSpyObj('LoggingService', ['log', 'error']);
    mockDownloaderService = jasmine.createSpyObj('DownloaderService', ['downloadFile']);

    // Setup observable defaults
    mockAuthService.checkAuth.and.returnValue(of({ isAuthenticated: true, user: { ID: 1, email: 'test@artist.com', Name: 'Test Artist' } }));
    mockSocketService.onPreviousMessages.and.returnValue(of([]));
    mockSocketService.onNewMessage.and.returnValue(of(null));
    mockSocketService.onTyping.and.returnValue(of(null));
    mockSocketService.onStopTyping.and.returnValue(of(null));
    mockItemService.getitemdata.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [DetailspageComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: DetailpageService, useValue: mockDetailpageService },
        { provide: SocketService, useValue: mockSocketService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: ProductService, useValue: mockProductService },
        { provide: ItemService, useValue: mockItemService },
        { provide: OrderCompleteService, useValue: mockOrderCompleteService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoggingService, useValue: mockLoggingService },
        { provide: DownloaderService, useValue: mockDownloaderService },
        Renderer2,
        DatePipe,
        ChangeDetectorRef
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DetailspageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and initialize order data', () => {
    expect(component).toBeTruthy();
    expect(component.orderlist.Order_ID).toBe('TEST-123');
    expect(component.totalItems).toBe(2);
  });

  it('should calculate initial progress as 0%', () => {
    expect(component.completedCount).toBe(0);
    expect(component.progressPercent).toBe(0);
    expect(component.canCompleteOrder).toBeFalse();
  });

  it('should update completedCount when item_urls are provided', () => {
    component.orderlist.item_urls = [
      { img_url: 'url1' },
      null
    ];
    expect(component.completedCount).toBe(1);
    expect(component.progressPercent).toBe(50);
    expect(component.canCompleteOrder).toBeFalse();
  });

  it('should allow completing order only when all items have uploads', () => {
    component.orderlist.item_urls = [
      { img_url: 'url1' },
      { img_url: 'url2' }
    ];
    expect(component.completedCount).toBe(2);
    expect(component.progressPercent).toBe(100);
    expect(component.canCompleteOrder).toBeTrue();
  });

  it('should update itemPosition when selitemposition is called', () => {
    component.selitemposition(1);
    expect(component.itemposition()).toBe(1);
  });

  it('should correctly determine if the current item is uploaded', () => {
    component.orderlist.item_urls = [
      { img_url: 'url1' },
      null
    ];
    component.selitemposition(0);
    expect(component.isItemUploaded).toBeTrue();

    component.selitemposition(1);
    expect(component.isItemUploaded).toBeFalse();
  });
});
