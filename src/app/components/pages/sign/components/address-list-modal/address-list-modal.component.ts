import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProfileService } from '../../profile';
import { CreateAddressComponent } from '../create-address/create-address.component';


@Component({
  selector: 'app-address-list-modal',
  imports: [CommonModule],
  templateUrl: './address-list-modal.component.html',
  styleUrls: ['./address-list-modal.component.scss']
})
export class AddressListModalComponent implements OnInit {
  addresses: any[] = [];
  selectedAddress: any = null;
  dropdownIndex: number | null = null;


  constructor(public activeModal: NgbActiveModal, private profileService: ProfileService, private modalService: NgbModal) {}

  ngOnInit() {
    this.loadAddresses();
  }

  loadAddresses() {
    this.profileService.getAddresses().subscribe({
      next: (response) => {
        this.addresses = response['data'];
        // Automatically pre-select the default address
        if (this.addresses && this.addresses.length > 0) {
          const defaultAddress = this.addresses.find((address: any) => address.defaultAddress === true);
          if (defaultAddress) {
            this.selectedAddress = defaultAddress;
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des adresses', error);
      }
    });
  }

  closeModal() {
    this.activeModal.close(this.selectedAddress);
  }

 selectAddress(address: any): void {
    this.selectedAddress = address;
  }

  addressOptionsDropdown() {

  }

  openCreateAddressModal() {
    const modalRef = this.modalService.open(CreateAddressComponent, {
      size: 'lg',
      backdrop: 'static', // Optional: Prevent closing by clicking outside
      keyboard: false // Optional: Disable closing with the Escape key
    });

    modalRef.result.then(
      (result) => {
        // console.log('Modal closed:', result);
        this.loadAddresses();
      },
      (reason) => {
        // console.log('Modal dismissed:', reason);
      }
    );
  }


  toggleDropdown(index: number, event: MouseEvent): void {
    event.stopPropagation();
    // console.log('Dropdown index:', index);
    this.dropdownIndex = this.dropdownIndex === index ? null : index;
  }

  // Edit an address
  editAddress(address: any): void {
    // console.log('Editing address:', address);
    this.dropdownIndex = null; // Close the dropdown after action
  }

  // Delete an address
  deleteAddress(address: any): void {
    // console.log('Deleting address:', address);
    this.addresses = this.addresses.filter(addr => addr !== address);
    this.dropdownIndex = null; // Close the dropdown after action
  }
}