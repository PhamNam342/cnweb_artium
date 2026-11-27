import { describe, expect, it } from 'vitest';
import {
  emptyForm,
  formFromArtwork,
  toArtworkInput,
  validateDetails,
  validateImages,
  validateTags,
  type ArtworkForm,
  type ImageItem,
} from './form';
import type { Artwork, Tag } from './types';
import { formatDimensions, formatVnd, fromCm, parseDecimal, parseVnd, toCm, toKg } from './units';

const form = (p: Partial<ArtworkForm> = {}): ArtworkForm => ({
  ...emptyForm(),
  title: 'Sóng',
  ...p,
});

describe('units', () => {
  it('đổi in ↔ cm, lbs → kg, làm tròn 2 số', () => {
    expect(toCm(10, 'in')).toBe(25.4);
    expect(fromCm(25.4, 'in')).toBe(10);
    expect(toCm(60, 'cm')).toBe(60);
    expect(toKg(10, 'lb')).toBe(4.54);
  });
  it('đọc số kiểu Việt (dấu phẩy) và tiền VND', () => {
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseVnd('25.000.000 ₫')).toBe(25_000_000);
    expect(formatVnd(25_000_000)).toBe('25.000.000');
  });
  it('hiển thị kích thước theo đơn vị đã chọn', () => {
    expect(
      formatDimensions({ heightCm: 25.4, widthCm: 50.8, depthCm: null, dimensionUnit: 'in' }),
    ).toBe('10 × 20 in');
  });
});

describe('validate', () => {
  it('bước ảnh: cần ít nhất 1 ảnh, chờ upload xong', () => {
    expect(validateImages([]).images).toBeDefined();
    const img = (status: ImageItem['status']): ImageItem => ({
      key: '1',
      previewUrl: '',
      status,
      progress: 0,
    });
    expect(validateImages([img('uploading')]).images).toBe('Chờ ảnh tải lên xong');
    expect(validateImages([img('uploaded')])).toEqual({});
  });

  it('bán thì cần giá + số lượng; hỏi giá thì không', () => {
    expect(validateDetails(form({ price: '' }))).toMatchObject({ price: 'Nhập giá bán' });
    expect(validateDetails(form({ price: '500' })).price).toMatch(/Tối thiểu/);
    expect(validateDetails(form({ price: '1.000.000', quantity: '0' })).quantity).toBeDefined();
    expect(validateDetails(form({ price: '1.000.000' }))).toEqual({});
    expect(validateDetails(form({ listingType: 'inquire' }))).toEqual({});
  });

  it('kích thước: số dương, tối đa 2 chữ số thập phân', () => {
    expect(
      validateDetails(form({ listingType: 'display_only', height: '0' })).height,
    ).toBeDefined();
    expect(validateDetails(form({ listingType: 'display_only', height: '1,234' })).height).toBe(
      'Tối đa 2 chữ số thập phân',
    );
    expect(validateDetails(form({ listingType: 'display_only', height: '80,5' }))).toEqual({});
  });

  it('đã bán + hiện trên hồ sơ: cần giá và ngày không ở tương lai', () => {
    const e = validateDetails(form({ listingType: 'sold', showSale: true }));
    expect(e).toMatchObject({ soldPrice: 'Nhập giá đã bán', soldAt: 'Chọn ngày bán' });
    expect(
      validateDetails(
        form({ listingType: 'sold', showSale: true, soldPrice: '2.000.000', soldAt: '2999-01-01' }),
      ).soldAt,
    ).toMatch(/tương lai/);
  });

  it('tag: cần ít nhất 1 chất liệu', () => {
    const tags: Tag[] = [
      { id: 'm', name: 'Sơn dầu', slug: 'son-dau', category: 'medium', isSystem: true },
      { id: 's', name: 'Trừu tượng', slug: 'truu-tuong', category: 'style', isSystem: true },
    ];
    expect(validateTags(form({ tagIds: ['s'] }), tags).tagIds).toBeDefined();
    expect(validateTags(form({ tagIds: ['m', 's'] }), tags)).toEqual({});
  });
});

describe('toArtworkInput', () => {
  it('đổi đơn vị về cm/kg, bỏ giá khi không bán, gom vận chuyển', () => {
    const input = toArtworkInput(
      form({
        dimensionUnit: 'in',
        height: '10',
        width: '20',
        weightUnit: 'lb',
        weight: '10',
        price: '12.500.000',
        quantity: '3',
        pkgHeight: '12',
        tagIds: ['a'],
      }),
    );
    expect(input).toMatchObject({
      heightCm: 25.4,
      widthCm: 50.8,
      depthCm: null,
      dimensionUnit: 'in',
      weightKg: 4.54,
      price: 12_500_000,
      quantityTotal: 3,
      shipping: { method: 'box', heightCm: 30.48 },
      saleRecord: null,
      tagIds: ['a'],
    });
    const shown = toArtworkInput(form({ listingType: 'display_only', price: '1.000.000' }));
    expect(shown.price).toBeNull();
    expect(shown.shipping).toBeNull();
  });

  it('tác phẩm từ API → form → API giữ nguyên số liệu', () => {
    const a = {
      title: 'Sóng',
      description: null,
      creationYear: 2024,
      edition: null,
      medium: 'Acrylic',
      widthCm: 50.8,
      heightCm: 25.4,
      depthCm: null,
      dimensionUnit: 'in',
      weightKg: null,
      weightUnit: 'kg',
      isFramed: true,
      listingType: 'for_sale',
      price: 15_000_000,
      quantityTotal: 1,
      allowOffers: false,
      shipping: null,
      saleRecord: null,
      folderId: null,
      tags: [],
    } as unknown as Artwork;
    const f = formFromArtwork(a);
    expect(f).toMatchObject({ height: '10', width: '20', price: '15.000.000', year: '2024' });
    expect(toArtworkInput(f)).toMatchObject({ heightCm: 25.4, widthCm: 50.8, price: 15_000_000 });
  });
});
